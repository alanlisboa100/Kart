// KARTOPIA - Game: scene, render loop, race orchestration, camera & ranking.
import * as THREE from 'three';
import { Track } from './track.js';
import { Kart } from './kart.js';
import { AIController } from './ai.js';
import { ItemSystem } from './items.js';
import { CHARACTERS, KARTS } from './data.js';

export class Game {
  constructor(canvas, hud, audio) {
    this.canvas = canvas;
    this.hud = hud; // { setLap,setPos,setSpeed,setDrift,setTime,setCountdown,setItem,onFinish }
    this.audio = audio || null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
    this.camera.position.set(0, 8, -14);

    this._addLights();

    this.clock = new THREE.Clock();
    this.karts = [];
    this.ai = new Map();
    this.player = null;
    this.track = null;
    this.items = null;
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
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x6688aa, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(60, 120, 40);
    this.scene.add(this.sun);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // --- Setup a race ---
  start({ trackDef, playerChar, playerKart, opponents = 5, input }) {
    this.cleanup();
    this.input = input;

    // Theme / sky / fog
    this.scene.background = new THREE.Color(trackDef.theme.sky);
    this.scene.fog = new THREE.Fog(trackDef.theme.fog, 180, 620);

    this.track = new Track(trackDef);
    this.scene.add(this.track.group);
    this.totalLaps = this.track.laps;

    // Item boxes + projectiles
    this.items = new ItemSystem(this.scene, this.track);
    this.items.onHit = (kart, type) => {
      if (this.audio && kart === this.player) this.audio.play('hit');
    };

    // Build grid: player + opponents
    const grid = [];
    grid.push({ char: playerChar, kart: playerKart, isPlayer: true, skill: 1 });
    const usedChars = new Set([playerChar.id]);
    for (let i = 0; i < opponents; i++) {
      const c = pickDifferent(CHARACTERS, usedChars) || CHARACTERS[(i + 1) % CHARACTERS.length];
      usedChars.add(c.id);
      const k = KARTS[(i + 2) % KARTS.length];
      grid.push({ char: c, kart: k, isPlayer: false, skill: 0.82 + Math.random() * 0.16 });
    }

    // Place on a staggered grid behind the start line.
    const start = this.track.startPos;
    const t = this.track.tangents[0];
    const n = this.track.normals[0];
    const back = new THREE.Vector3(-t.x, 0, -t.z);

    grid.forEach((g, i) => {
      const kart = new Kart(this.scene, g.char, g.kart, { isPlayer: g.isPlayer });
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
      }
      // hold karts still during countdown
      for (const k of this.karts) k.update(0, { throttle: 0, brake: 0, steer: 0, drift: false }, this.track);
      this._followCamera(dt, true);
      return;
    }

    if (this.state === 'racing' || this.state === 'finished') {
      if (this.state === 'racing') this.raceTime += dt;

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

  _updateRanking() {
    const sorted = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => (k.place = i + 1));
  }

  _updateHud() {
    const p = this.player;
    this.hud.setLap(Math.min(p.lap + 1, this.totalLaps), this.totalLaps);
    this.hud.setPos(p.place, this.karts.length);
    this.hud.setSpeed(Math.round(Math.abs(p.speed) * 3.6));
    this.hud.setDrift(p.drifting ? p.driftTier : 0);
    this.hud.setTime(this.raceTime);
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
      case 'lightning':
        for (const other of this.karts) {
          if (other !== kart && !other.finished) other.applyShrink(3);
        }
        if (this.audio) this.audio.play('lightning');
        break;
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

  _finishRace() {
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
        time: k.finished ? k.finishTime : null,
      })));
    }, 800);
  }

  _snapCamera() {
    const p = this.player;
    const fwd = p.forward();
    this.camPos.copy(p.pos).addScaledVector(fwd, -12).add(new THREE.Vector3(0, 7, 0));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(p.pos.x, p.pos.y + 1.5, p.pos.z);
  }

  _followCamera(dt, slow) {
    const p = this.player;
    const fwd = p.forward();
    const speedFactor = Math.min(Math.abs(p.speed) / p.maxSpeed, 1);
    const dist = 12 + speedFactor * 2.5;
    const height = 6.5;
    const desired = new THREE.Vector3()
      .copy(p.pos)
      .addScaledVector(fwd, -dist)
      .add(new THREE.Vector3(0, height, 0));
    const lerp = slow ? 0.04 : 1 - Math.pow(0.0015, dt); // frame-rate independent
    this.camera.position.lerp(desired, lerp);
    this.camTarget.lerp(
      new THREE.Vector3(p.pos.x + fwd.x * 6, p.pos.y + 1.6, p.pos.z + fwd.z * 6),
      slow ? 0.05 : 1 - Math.pow(0.0008, dt)
    );
    this.camera.lookAt(this.camTarget);
  }

  cleanup() {
    for (const k of this.karts) k.dispose();
    this.karts = [];
    this.ai.clear();
    this.player = null;
    if (this.items) { this.items.dispose(); this.items = null; }
    if (this.audio) { this.audio.stopEngine(); this.audio.stopMusic(); }
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
  if (frac < 0.25) pool = ['banana', 'banana', 'shell', 'boost'];
  else if (frac < 0.6) pool = ['shell', 'banana', 'boost', 'boost'];
  else pool = ['boost', 'boost', 'shell', 'banana', 'lightning'];
  return pool[Math.floor(Math.random() * pool.length)];
}
