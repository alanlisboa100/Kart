// KARTOPIA - Game: scene, render loop, race orchestration, camera & ranking.
import * as THREE from 'three';
import { Track } from './track.js';
import { Kart } from './kart.js';
import { AIController } from './ai.js';
import { ItemSystem } from './items.js';
import { FXSystem } from './fx.js';
import { CHARACTERS, KARTS } from './data.js';

export class Game {
  constructor(canvas, hud, audio) {
    this.canvas = canvas;
    this.hud = hud; // { setLap,setPos,setSpeed,setDrift,setTime,setCountdown,setItem,onFinish }
    this.audio = audio || null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    // Warmer, punchier image
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
    this.camera.position.set(0, 8, -14);
    this.baseFov = 62;
    this.fov = 62;
    this.sky = null;

    this._addLights();

    this.clock = new THREE.Clock();
    this.karts = [];
    this.ai = new Map();
    this.player = null;
    this.track = null;
    this.items = null;
    this.fx = null;
    this._wasBoosting = false;
    this._lastCount = null;
    this.state = 'idle'; // idle | countdown | racing | finished
    this.countdown = 0;
    this.raceTime = 0;
    this.totalLaps = 3;
    this.camTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3();

    this._running = false;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clock.getDelta(); // swallow gap
    });
  }

  _addLights() {
    this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x44607a, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
    this.sun.position.set(60, 120, 40);
    this.scene.add(this.sun);
    // subtle fill from the opposite side to round out the karts
    this.fill = new THREE.DirectionalLight(0xbfd4ff, 0.35);
    this.fill.position.set(-50, 40, -30);
    this.scene.add(this.fill);
  }

  // Big gradient sky dome + a soft sun glow + drifting clouds, themed per track.
  _buildSky(theme) {
    const group = new THREE.Group();

    // Gradient dome (vertex-colored, lit-independent)
    const top = new THREE.Color(theme.sky);
    const bottom = new THREE.Color(theme.fog);
    const geo = new THREE.SphereGeometry(900, 24, 16);
    const pos = geo.attributes.position;
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 900; // -1..1
      const t = THREE.MathUtils.clamp((y + 0.2) / 1.0, 0, 1);
      c.copy(bottom).lerp(top, t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    group.add(dome);

    // Sun / moon billboard
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(70, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.9, fog: false })
    );
    sun.position.set(-260, 320, -600);
    group.add(sun);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(140, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.18, fog: false })
    );
    glow.position.copy(sun.position).setZ(-601);
    group.add(glow);

    // Fluffy clouds (a few soft sphere clusters)
    const dark = theme.sky < 0x333333;
    if (!dark) {
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
      for (let i = 0; i < 14; i++) {
        const cloud = new THREE.Group();
        const blobs = 3 + Math.floor(Math.random() * 3);
        for (let b = 0; b < blobs; b++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(18 + Math.random() * 16, 8, 6), cloudMat);
          s.position.set((b - blobs / 2) * 22, Math.random() * 8, Math.random() * 10);
          s.scale.y = 0.6;
          cloud.add(s);
        }
        const ang = Math.random() * Math.PI * 2;
        const rad = 400 + Math.random() * 300;
        cloud.position.set(Math.cos(ang) * rad, 160 + Math.random() * 120, Math.sin(ang) * rad);
        group.add(cloud);
      }
    }

    this.scene.add(group);
    this.sky = group;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // --- Setup a race ---
  start({ trackDef, playerChar, playerKart, opponents = 5, input, roster = null }) {
    this.cleanup();
    this.input = input;

    // Theme / sky / fog
    this.scene.background = new THREE.Color(trackDef.theme.sky);
    this.scene.fog = new THREE.Fog(trackDef.theme.fog, 220, 780);
    this._buildSky(trackDef.theme);

    this.track = new Track(trackDef);
    this.scene.add(this.track.group);
    this.totalLaps = this.track.laps;
    this._initMinimap();

    // Item boxes + projectiles
    this.items = new ItemSystem(this.scene, this.track);
    this.items.onHit = (kart, type) => {
      if (this.audio && kart === this.player) this.audio.play('hit');
      if (this.fx) this.fx.burst(kart.pos, 0xff4444, 12, 10);
      if (kart === this.player && this.hud.taunt) this.hud.taunt('hit');
    };
    // Bomb explosion: big fiery burst + sound
    this.items.onExplode = (pos) => {
      if (this.fx) { this.fx.burst(pos, 0xff7a1a, 22, 16); this.fx.burst(pos, 0xffe14d, 14, 12); }
      if (this.audio) this.audio.play('hit');
    };

    // Particle FX
    this.fx = new FXSystem(this.scene);

    // Build grid: player + opponents
    const grid = [];
    grid.push({ char: playerChar, kart: playerKart, isPlayer: true, skill: 1 });
    if (roster && roster.length) {
      // Fixed roster (championship): same rivals every race for fair standings.
      for (const r of roster) {
        grid.push({ char: r.char, kart: r.kart, isPlayer: false, skill: r.skill, rivalId: r.id });
      }
    } else {
      const usedChars = new Set([playerChar.id]);
      for (let i = 0; i < opponents; i++) {
        const c = pickDifferent(CHARACTERS, usedChars) || CHARACTERS[(i + 1) % CHARACTERS.length];
        usedChars.add(c.id);
        const k = KARTS[(i + 2) % KARTS.length];
        grid.push({ char: c, kart: k, isPlayer: false, skill: 0.9 + Math.random() * 0.1 });
      }
    }

    // Place on a staggered grid behind the start line.
    const start = this.track.startPos;
    const t = this.track.tangents[0];
    const n = this.track.normals[0];
    const back = new THREE.Vector3(-t.x, 0, -t.z);

    grid.forEach((g, i) => {
      const kart = new Kart(this.scene, g.char, g.kart, { isPlayer: g.isPlayer });
      kart.rivalId = g.rivalId || null;
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const p = new THREE.Vector3()
        .copy(start)
        .addScaledVector(back, 6 + row * 7)
        .addScaledVector(n, col * 4.2);
      kart.placeAt(p, this.track.startHeading);
      this.karts.push(kart);
      if (g.isPlayer) this.player = kart;
      else this.ai.set(kart, new AIController(g.skill));
    });

    this.resize();
    this._snapCamera();

    this.state = 'countdown';
    this.countdown = 3.2;
    this._lastCount = null;
    this.raceTime = 0;
    this._wasBoosting = false;
    this._launchResult = null; // perfect-start state (set during countdown)
    this._lastPlace = null;    // for trash-talk on position changes
    this._tauntCd = 0;
    if (this.hud.setItem) this.hud.setItem(null);
    if (this.audio) { this.audio.startEngine(); this.audio.startMusic(); }
    this.clock.getDelta();
    if (!this._running) { this._running = true; this._loop(); }
  }

  _loop = () => {
    if (!this._running) return;
    requestAnimationFrame(this._loop);
    let dt = this.clock.getDelta();
    dt = Math.min(dt, 0.05); // clamp big gaps
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  _update(dt) {
    this._lastDt = dt;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown > 0) {
        const n = Math.ceil(this.countdown);
        if (n !== this._lastCount) { this._lastCount = n; this.hud.setCountdown(n); if (this.audio) this.audio.play('count'); }
      } else {
        this.state = 'racing';
        this.hud.setCountdown(0); // shows "JÁ!"
        if (this.audio) this.audio.play('go');
        setTimeout(() => this.hud.setCountdown(null), 650);
        this._resolvePerfectStart();
      }
      // --- Perfect start: detect the player's launch input timing ---
      if (this._launchResult == null && this.input && this.input.launchHeld) {
        if (this.input.launchHeld()) {
          // perfect window is the last ~0.45s of the countdown
          if (this.countdown <= 0.45 && this.countdown > -0.05) this._launchResult = 'perfect';
          else if (this.countdown > 0.45) this._launchResult = 'early'; // jumped the gun
        }
      }
      // hold karts still during countdown
      for (const k of this.karts) k.update(0, { throttle: 0, brake: 0, steer: 0, drift: false }, this.track);
      if (this.track) this.track.update(dt, this.raceTime);
      this._followCamera(dt, true);
      return;
    }

    if (this.state === 'racing' || this.state === 'finished') {
      if (this.state === 'racing') this.raceTime += dt;

      this._applyRubberBanding();

      // player input
      const pInput = this.input ? this.input.state : { throttle: 0, brake: 0, steer: 0, drift: false };
      for (const kart of this.karts) {
        if (kart === this.player) {
          kart.update(dt, this.state === 'finished' && kart.finished ? { throttle: 0, brake: 0, steer: 0, drift: false } : pInput, this.track);
        } else {
          const ctrl = this.ai.get(kart).control(kart, this.track);
          kart.update(dt, ctrl, this.track);
        }
        // finish detection
        if (!kart.finished && kart.lap >= this.totalLaps) {
          kart.finished = true;
          kart.finishTime = this.raceTime;
        }
      }

      this._updateRanking();
      this._updateItems(dt);
      this._separateKarts();
      if (this.track) this.track.update(dt, this.raceTime);
      this._emitDriftSmoke(dt);
      if (this.fx) this.fx.update(dt);
      this._followCamera(dt, false);
      this._updateHud();
      this._updateAudio();

      // End race when player finishes
      if (this.player.finished && this.state !== 'finished') {
        this.state = 'finished';
        this._finishRace();
      }
    }
  }

  // Rubber-banding: nudge AI top speed based on each rival's progress gap to
  // the player. Rivals behind get a small boost; rivals far ahead ease off.
  // Keeps the pack tight and the race exciting without feeling unfair.
  _applyRubberBanding() {
    const player = this.player;
    if (!player) return;
    for (const k of this.karts) {
      if (k === player) { k.rubber = 1; continue; }
      const gap = player.progress - k.progress; // >0 means rival is BEHIND player
      // map gap -> multiplier: behind => up to +12%, ahead => down to -8%
      let mult = 1 + THREE.MathUtils.clamp(gap * 0.9, -0.08, 0.12);
      k.rubber = mult;
    }
  }

  _updateRanking() {
    const sorted = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => (k.place = i + 1));

    // Trash-talk on the player's position changing (throttled).
    const place = this.player ? this.player.place : 0;
    if (this._lastPlace == null) this._lastPlace = place;
    this._tauntCd = (this._tauntCd || 0) - (this._lastDt || 0);
    if (place !== this._lastPlace && this.state === 'racing' && (this._tauntCd || 0) <= 0) {
      if (place < this._lastPlace) this.hud.taunt && this.hud.taunt('pass');     // moved up
      else this.hud.taunt && this.hud.taunt('passed');                          // dropped back
      this._tauntCd = 3.5; // cooldown so it doesn't spam
    }
    this._lastPlace = place;
  }

  _updateHud() {
    const p = this.player;
    this.hud.setLap(Math.min(p.lap + 1, this.totalLaps), this.totalLaps);
    this.hud.setPos(p.place, this.karts.length);
    this.hud.setSpeed(Math.round(Math.abs(p.speed) * 3.6));
    this.hud.setDrift(p.drifting ? p.driftTier : 0);
    this.hud.setTime(this.raceTime);
    this._drawMinimap();
  }

  // Set up the minimap canvas + a world->map transform for the current track.
  _initMinimap() {
    this._mmCanvas = (typeof document !== 'undefined') ? document.getElementById('minimap') : null;
    this._mmCtx = this._mmCanvas ? this._mmCanvas.getContext('2d') : null;
    if (!this._mmCtx || !this.track) return;
    // bounds of the track centerline
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of this.track.samples) {
      if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z; if (s.z > maxZ) maxZ = s.z;
    }
    const w = maxX - minX || 1, h = maxZ - minZ || 1;
    const pad = 14;
    const size = this._mmCanvas.width;
    const sc = (size - pad * 2) / Math.max(w, h);
    this._mm = {
      sc,
      ox: (size - w * sc) / 2 - minX * sc,
      oy: (size - h * sc) / 2 - minZ * sc,
      size,
    };
  }

  _drawMinimap() {
    const ctx = this._mmCtx, mm = this._mm;
    if (!ctx || !mm || !this.track) return;
    const toX = (x) => x * mm.sc + mm.ox;
    const toY = (z) => z * mm.sc + mm.oy;
    ctx.clearRect(0, 0, mm.size, mm.size);

    // track ribbon
    ctx.beginPath();
    const s0 = this.track.samples[0];
    ctx.moveTo(toX(s0.x), toY(s0.z));
    for (let i = 1; i < this.track.samples.length; i += 3) {
      const s = this.track.samples[i];
      ctx.lineTo(toX(s.x), toY(s.z));
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,60,80,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // karts: rivals as small dots, player highlighted
    for (const k of this.karts) {
      if (k === this.player) continue;
      ctx.fillStyle = '#9bb8ff';
      ctx.beginPath();
      ctx.arc(toX(k.pos.x), toY(k.pos.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = this.player;
    ctx.fillStyle = '#ff2e97';
    ctx.beginPath();
    ctx.arc(toX(p.pos.x), toY(p.pos.z), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  _updateItems(dt) {
    if (!this.items) return;

    // Box pickups -> start roulette
    const pickups = this.items.update(dt, this.karts, this.raceTime);
    for (const k of pickups) {
      k.roulette = 0.9;
      if (k === this.player && this.audio) this.audio.play('item');
    }

    // Resolve roulettes, drive use of held items
    for (const k of this.karts) {
      if (k.roulette > 0) {
        k.roulette -= dt;
        if (k.roulette <= 0) {
          k.heldItem = rollItem(k.place, this.karts.length);
          if (k === this.player) {
            if (this.hud.setItem) this.hud.setItem(k.heldItem);
          } else {
            k.aiItemTimer = 0.6 + Math.random() * 1.8;
          }
        } else if (k === this.player && this.hud.setItem) {
          this.hud.setItem('roll');
        }
      }
    }

    // Player uses item on demand
    if (this.input && this.input.pollUse && this.input.pollUse()) {
      if (this.player.heldItem && this.player.roulette <= 0) this.useItem(this.player);
    }

    // AI uses items after a short delay
    for (const k of this.karts) {
      if (k === this.player || !k.heldItem || k.roulette > 0 || k.finished) continue;
      k.aiItemTimer -= dt;
      if (k.aiItemTimer <= 0) this.useItem(k);
    }
  }

  useItem(kart) {
    const item = kart.heldItem;
    if (!item) return;
    kart.heldItem = null;
    if (kart === this.player && this.hud.setItem) this.hud.setItem(null);

    switch (item) {
      case 'boost':
        kart.applyItemBoost(1.4);
        if (this.audio && kart === this.player) this.audio.play('boost');
        break;
      case 'banana':
        this.items.dropBanana(kart);
        if (this.audio && kart === this.player) this.audio.play('use');
        break;
      case 'shell':
        this.items.fireShell(kart);
        if (this.audio && kart === this.player) this.audio.play('shell');
        break;
      case 'bomb':
        this.items.dropBomb(kart);
        if (this.audio && kart === this.player) this.audio.play('use');
        break;
      case 'oil':
        this.items.dropOil(kart);
        if (this.audio && kart === this.player) this.audio.play('use');
        break;
      case 'lightning':
        for (const other of this.karts) {
          if (other !== kart && !other.finished) other.applyShrink(3);
        }
        if (this.audio) this.audio.play('lightning');
        break;
    }
  }

  // Soft, silent separation so karts don't overlap. No speed loss, no shake,
  // no sound, no particles - just a gentle nudge apart. ("batidas" removed.)
  _separateKarts() {
    const R = 2.4;
    const minDist = R * 2;
    const karts = this.karts;
    for (let i = 0; i < karts.length; i++) {
      const a = karts[i];
      for (let j = i + 1; j < karts.length; j++) {
        const b = karts[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0 && d < minDist) {
          const nx = dx / d, nz = dz / d;
          const push = (minDist - d) / 2;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }
  }

  _updateAudio() {
    if (!this.audio) return;
    const p = this.player;
    const speed01 = Math.min(Math.abs(p.speed) / p.maxSpeed, 1);
    const boosting = p.boostTimer > 0;
    this.audio.setEngine(speed01, boosting);
    if (boosting && !this._wasBoosting) this.audio.play('boost');
    this._wasBoosting = boosting;
  }

  // Emit drift smoke / boost dust from each kart's rear wheels. Throttled by a
  // timer so we spawn a steady stream without flooding the particle pool.
  // Resolve the launch-timing minigame the instant the lights go green.
  _resolvePerfectStart() {
    const p = this.player;
    if (!p) return;
    if (this._launchResult === 'perfect') {
      p.applyItemBoost(1.6);
      if (this.fx) this.fx.burst(p.pos, 0x00f5d4, 16, 12);
      if (this.audio) this.audio.play('boost');
      if (this.hud.flashMsg) this.hud.flashMsg('LARGADA PERFEITA! 🚀');
    } else if (this._launchResult === 'early') {
      // jumped the gun: lose all launch momentum (bog down off the line)
      p.speed = 0;
      if (this.hud.flashMsg) this.hud.flashMsg('Adiantou! 😬');
    }
  }

  _emitDriftSmoke(dt) {
    if (!this.fx) return;
    this._smokeTimer = (this._smokeTimer || 0) - dt;
    if (this._smokeTimer > 0) return;
    this._smokeTimer = 0.04; // ~25 puffs/sec budget shared across karts
    for (const k of this.karts) {
      const drifting = k.drifting && Math.abs(k.speed) > 4;
      const boosting = k.boostTimer > 0 && Math.abs(k.speed) > 6;
      if (!drifting && !boosting) continue;
      const fwd = k.forward();
      // rear of the kart, slightly behind
      const bx = k.pos.x - fwd.x * 1.4;
      const bz = k.pos.z - fwd.z * 1.4;
      // perpendicular for left/right wheels
      const px = -fwd.z, pz = fwd.x;
      const tier = k.driftTier;
      // drift smoke tints with the mini-turbo tier; boost dust is warm
      const color = boosting ? 0x9fe8ff
        : tier >= 3 ? 0xd9b3ff : tier >= 2 ? 0xffd9a8 : 0xe6e6e6;
      for (const side of [-1, 1]) {
        this.fx.puff(bx + px * 0.85 * side, 0.35, bz + pz * 0.85 * side, color, drifting ? 0.5 : 0.35);
      }
    }
  }

  _finishRace() {
    // Celebrate a win with a taunt before the results screen.
    if (this.player && this.player.place === 1 && this.hud.taunt) this.hud.taunt('win');
    // Let AI keep going briefly, then show results
    const results = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    setTimeout(() => {
      this.hud.onFinish(results.map((k, i) => ({
        place: i + 1,
        name: k.charDef.name,
        kart: k.kartDef.name,
        isPlayer: k === this.player,
        rivalId: k.rivalId || (k === this.player ? 'player' : null),
        time: k.finished ? k.finishTime : null,
      })));
    }, 800);
  }

  _snapCamera() {
    const p = this.player;
    const fwd = p.forward();
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(p.pos).addScaledVector(fwd, -13).add(new THREE.Vector3(0, 6.5, 0));
    this.camTarget.set(p.pos.x + fwd.x * 9, p.pos.y + 1.8, p.pos.z + fwd.z * 9);
    this.camera.lookAt(this.camTarget);
    this.fov = this.baseFov;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  _followCamera(dt, slow) {
    const p = this.player;
    const fwd = p.forward();
    const speedFactor = Math.min(Math.abs(p.speed) / p.maxSpeed, 1);
    const boosting = p.boostTimer > 0;

    // Classic chase cam: directly behind the kart, a bit above, looking ahead.
    // Stable up vector + plain lookAt => rock-solid horizon (no roll hacks).
    const dist = 13 + speedFactor * 2.0;
    const height = 6.5;
    const desired = new THREE.Vector3()
      .copy(p.pos)
      .addScaledVector(fwd, -dist)
      .add(new THREE.Vector3(0, height, 0));

    // Frame-rate-independent smoothing, snappy enough to keep up with the kart.
    const posK = slow ? 0.08 : 1 - Math.pow(0.0006, dt);
    this.camera.position.lerp(desired, posK);

    // Aim slightly ahead of and above the kart for good track framing.
    const lookGoal = new THREE.Vector3(
      p.pos.x + fwd.x * 9,
      p.pos.y + 1.8,
      p.pos.z + fwd.z * 9
    );
    this.camTarget.lerp(lookGoal, slow ? 0.08 : 1 - Math.pow(0.0006, dt));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.camTarget);

    // Subtle dynamic FOV for a sense of speed (no exaggeration).
    const targetFov = this.baseFov + speedFactor * 4 + (boosting ? 6 : 0);
    this.fov += (targetFov - this.fov) * (1 - Math.pow(0.05, dt));
    if (Math.abs(this.fov - this.camera.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  cleanup() {
    for (const k of this.karts) k.dispose();
    this.karts = [];
    this.ai.clear();
    this.player = null;
    if (this.items) { this.items.dispose(); this.items = null; }
    if (this.fx) { this.fx.dispose(); this.fx = null; }
    if (this.audio) { this.audio.stopEngine(); this.audio.stopMusic(); }
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose(); }
      });
      this.sky = null;
    }
    if (this.track) {
      this.scene.remove(this.track.group);
      this.track.dispose();
      this.track = null;
    }
  }

  destroy() {
    this._running = false;
    window.removeEventListener('resize', this._onResize);
    this.cleanup();
    this.renderer.dispose();
  }
}

function pickDifferent(list, used) {
  const avail = list.filter((x) => !used.has(x.id));
  if (avail.length === 0) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

// Position-based item distribution (rubber-banding): leaders get defensive
// items, trailers get a chance at the lightning.
function rollItem(place, total) {
  const frac = total > 1 ? (place - 1) / (total - 1) : 0;
  let pool;
  // Leaders get defensive drops (banana/oil/bomb); trailers get speed/lightning.
  if (frac < 0.25) pool = ['banana', 'oil', 'bomb', 'shell', 'boost'];
  else if (frac < 0.6) pool = ['shell', 'banana', 'oil', 'bomb', 'boost', 'boost'];
  else pool = ['boost', 'boost', 'shell', 'banana', 'lightning'];
  return pool[Math.floor(Math.random() * pool.length)];
}
