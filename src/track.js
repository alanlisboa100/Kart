// KARTOPIA - Track: builds road mesh from a smooth closed curve and provides
// nearest-point queries used for off-road detection, walls and lap progress.
import * as THREE from 'three';
import { makeLoop } from './data.js';

export class Track {
  constructor(def) {
    this.def = def;
    this.theme = def.theme;
    this.width = def.width;
    this.halfWidth = def.width / 2;
    this.wallMargin = 2.2; // extra room before the invisible wall
    this.laps = def.laps || 3;
    this.group = new THREE.Group();

    // --- Build smooth closed curve from control points ---
    const ctrl = makeLoop(def.loop).map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(ctrl, true, 'catmullrom', 0.5);

    // Evenly spaced samples around the loop (used for everything).
    this.N = 600;
    this.samples = this.curve.getSpacedPoints(this.N); // length N+1, last ~= first
    this.samples.length = this.N; // drop duplicate closing point

    // Tangents & lateral normals (XZ plane).
    this.tangents = [];
    this.normals = [];
    for (let i = 0; i < this.N; i++) {
      const a = this.samples[i];
      const b = this.samples[(i + 1) % this.N];
      const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      this.tangents.push(t);
      // Perpendicular in XZ: (tz, 0, -tx)
      this.normals.push(new THREE.Vector3(t.z, 0, -t.x));
    }

    this._buildEnvironment();
    this._buildRoad();
    this._buildCenterLine();
    this._buildFences();
    this._buildTracksideProps();
    this._buildCity();
    this._buildSkyTraffic();
    this._buildStartLine();
    this._buildStartGantry();
    this._buildGrandstands();
    this._buildBoostPads();
    this._buildDecorations();
  }

  // Floating ambience that gently moves: blimps / hot-air balloons drifting
  // high above the circuit. Animated each frame via update().
  _buildSkyTraffic() {
    this.skyObjects = [];
    const dark = this.theme.sky < 0x333333;
    const palette = [0xff5a5f, 0xffd23f, 0x3d8bff, 0x2ec4b6, 0xff7ad1, 0x9b5de5];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const color = palette[i % palette.length];
      const isBlimp = i % 2 === 0;
      if (isBlimp) {
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(5, 14, 10),
          new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: dark ? color : 0x000000, emissiveIntensity: dark ? 0.3 : 0 })
        );
        body.scale.set(2.2, 1, 1);
        g.add(body);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
        fin.position.set(-9, 0, 0);
        g.add(fin);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 1.2), new THREE.MeshStandardMaterial({ color: 0x333a45, roughness: 0.6 }));
        cabin.position.set(0, -1.4, 0);
        g.add(cabin);
      } else {
        const balloon = new THREE.Mesh(
          new THREE.SphereGeometry(4, 14, 12),
          new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
        );
        balloon.scale.set(1, 1.2, 1);
        g.add(balloon);
        const basket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
        basket.position.y = -5.2;
        g.add(basket);
      }
      // distribute around the circuit, high up
      const ang = (i / count) * Math.PI * 2;
      const radius = 140 + i * 18;
      g.position.set(Math.cos(ang) * radius, 55 + i * 8, Math.sin(ang) * radius);
      this.group.add(g);
      this.skyObjects.push({
        mesh: g,
        angle: ang,
        radius,
        speed: 0.04 + Math.random() * 0.05,
        bobPhase: Math.random() * Math.PI * 2,
        baseY: g.position.y,
      });
    }
  }

  // Animate ambient sky traffic. Called by Game each frame.
  update(dt, time) {
    if (this.skyObjects) {
      for (const o of this.skyObjects) {
        o.angle += o.speed * dt;
        o.mesh.position.x = Math.cos(o.angle) * o.radius;
        o.mesh.position.z = Math.sin(o.angle) * o.radius;
        o.mesh.position.y = o.baseY + Math.sin(time * 0.5 + o.bobPhase) * 2.5;
        o.mesh.rotation.y = -o.angle + Math.PI / 2; // face travel direction
      }
    }
    // Pulsing boost-pad chevrons (a wave of glow running forward).
    if (this.boostArrows) {
      for (const a of this.boostArrows) {
        const pulse = (Math.sin(time * 6 - a.phase * 3) + 1) * 0.5; // 0..1
        a.mat.emissiveIntensity = 0.5 + pulse * 1.3;
        a.mesh.position.y = a.baseY + pulse * 0.12;
      }
    }
    // Crowd "wave": spectators bob up and down, rippling across the stand.
    if (this.crowd) {
      for (const c of this.crowd) {
        const jump = Math.max(0, Math.sin(time * 4 - c.phase)) * 0.35;
        c.body.position.y = c.baseY + jump;
        c.head.position.y = c.headBaseY + jump;
      }
    }
    // Flags tremulate (gentle wave + flutter scale).
    if (this.flags) {
      for (const f of this.flags) {
        f.mesh.rotation.y = Math.sin(time * 3 + f.phase) * 0.35;
        f.mesh.rotation.z = Math.sin(time * 5 + f.phase) * 0.08;
      }
    }
  }

  // --- Placement helpers: keep scenery OFF the track ---
  // Squared min distance from (x,z) to the track centerline (downsampled for speed).
  _minDistToTrackSq(x, z) {
    let best = Infinity;
    for (let i = 0; i < this.N; i += 4) {
      const s = this.samples[i];
      const dx = x - s.x, dz = z - s.z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return best;
  }

  // Find a point near sample `idx` on the given side that is at least
  // `clearance` away from EVERY part of the track (handles loop-backs in
  // tight curves). Pushes further out if the first spot is too close.
  // Returns {x, z} or null if no clear spot was found.
  _placeOutside(idx, side, baseDist, clearance) {
    const i = ((idx % this.N) + this.N) % this.N;
    const c = this.samples[i];
    const n = this.normals[i];
    const cl2 = clearance * clearance;
    for (let extra = 0; extra <= 140; extra += 8) {
      const dist = baseDist + extra;
      const x = c.x + n.x * dist * side;
      const z = c.z + n.z * dist * side;
      if (this._minDistToTrackSq(x, z) >= cl2) return { x, z };
    }
    return null;
  }

  // A ring of buildings around the circuit so the world feels like a living
  // city skyline rather than empty space. Windows are baked into a texture.
  _buildCity() {
    const rng = mulberry32(0x01CE ^ hashStr(this.def.id));
    const dark = this.theme.sky < 0x333333; // neon/night themes
    const wallColors = dark
      ? [0x2a2740, 0x1f2a44, 0x33264d, 0x222b3a]
      : [0xb9c2d0, 0xd6c7a8, 0xc9d3dd, 0xa8b8c8, 0xe0d2c0];
    const litColor = dark ? '#ffe27a' : '#bfe6ff';
    const offColor = dark ? '#1b2233' : '#5a6473';

    // Shared window texture (a grid of lit/unlit windows)
    const makeWindowTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = dark ? '#10131f' : '#3a4250';
      ctx.fillRect(0, 0, 32, 64);
      for (let y = 2; y < 64; y += 6) {
        for (let x = 3; x < 32; x += 7) {
          ctx.fillStyle = rng() > 0.45 ? litColor : offColor;
          ctx.fillRect(x, y, 4, 4);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };
    const winTexA = makeWindowTex();
    const winTexB = makeWindowTex();

    const ringCount = 46;
    for (let i = 0; i < ringCount; i++) {
      const idx = Math.floor((i / ringCount) * this.N + rng() * 6);
      const side = rng() < 0.5 ? 1 : -1;
      const h = 14 + rng() * 60;
      const w = 8 + rng() * 12;
      const d = 8 + rng() * 12;
      // Place far outside the track, guaranteed clear of EVERY part of the loop.
      const baseDist = this.halfWidth + 55 + rng() * 110;
      const clearance = this.halfWidth + 42 + Math.max(w, d);
      const spot = this._placeOutside(idx, side, baseDist, clearance);
      if (!spot) continue; // no clear room here (tight inner curve) -> skip
      const tex = (rng() > 0.5 ? winTexA : winTexB);
      const repU = Math.max(1, Math.round(w / 6));
      const repV = Math.max(2, Math.round(h / 6));
      const bMat = new THREE.MeshStandardMaterial({
        color: wallColors[Math.floor(rng() * wallColors.length)],
        roughness: 0.85,
        map: tex,
        emissive: dark ? 0x2a2333 : 0x000000,
        emissiveIntensity: dark ? 0.25 : 0,
      });
      // clone the texture's repeat per building without re-uploading the image
      bMat.map = tex.clone();
      bMat.map.needsUpdate = true;
      bMat.map.wrapS = bMat.map.wrapT = THREE.RepeatWrapping;
      bMat.map.repeat.set(repU, repV);
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
      building.position.set(spot.x, h / 2 - 0.05, spot.z);
      building.rotation.y = rng() * Math.PI;
      building.userData.scenery = true;
      this.group.add(building);

      // rooftop cap / antenna for variety
      if (rng() > 0.5) {
        const capMat = new THREE.MeshStandardMaterial({ color: dark ? 0xff2e97 : 0x8a93a3, emissive: dark ? 0xff2e97 : 0x000000, emissiveIntensity: dark ? 0.5 : 0, roughness: 0.5 });
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4 + rng() * 6, 6), capMat);
        antenna.position.set(building.position.x, h + 2, building.position.z);
        this.group.add(antenna);
      }
    }
  }

  // Cones, tire stacks and billboards lining the track to fill it out.
  _buildTracksideProps() {
    const rng = mulberry32(0xBADA55 ^ hashStr(this.def.id));
    const off = this.halfWidth + 2.4;

    // Shared geometries/materials (reused for performance)
    const coneGeo = new THREE.ConeGeometry(0.5, 1.1, 10);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
    const coneBandGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.22, 10);
    const coneBandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const tireGeo = new THREE.TorusGeometry(0.55, 0.26, 8, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 });

    const makeCone = () => {
      const g = new THREE.Group();
      const c = new THREE.Mesh(coneGeo, coneMat); c.position.y = 0.55; g.add(c);
      const band = new THREE.Mesh(coneBandGeo, coneBandMat); band.position.y = 0.6; g.add(band);
      return g;
    };
    const makeTireStack = () => {
      const g = new THREE.Group();
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const t = new THREE.Mesh(tireGeo, tireMat);
        t.rotation.x = Math.PI / 2;
        t.position.y = 0.28 + i * 0.42;
        g.add(t);
      }
      return g;
    };
    const billboardColors = [0xff5a5f, 0x3d8bff, 0x2ec4b6, 0xffd23f, 0xff7ad1, 0x9b5de5];
    const makeBillboard = () => {
      const g = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: 0x555a66, roughness: 0.8 });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 8), postMat);
        post.position.set(sx * 2, 2.5, 0); g.add(post);
      }
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.6, 0.3),
        new THREE.MeshStandardMaterial({
          color: billboardColors[Math.floor(rng() * billboardColors.length)],
          emissive: 0x111111, roughness: 0.5,
        })
      );
      panel.position.y = 5.2; g.add(panel);
      return g;
    };

    // Sprinkle props around the loop, alternating sides.
    const propClear = this.halfWidth + 1.5;
    const propClear2 = propClear * propClear;
    for (let i = 0; i < this.N; i += 9) {
      const r = rng();
      const side = (i % 18 === 0) ? 1 : -1;
      const c = this.samples[i];
      const n = this.normals[i];
      const t = this.tangents[i];
      let prop = null;
      let dist = off;
      if (r < 0.5) { prop = makeCone(); dist = off + rng() * 0.6; }
      else if (r < 0.78) { prop = makeTireStack(); dist = off + 0.5; }
      else if (r < 0.86) { prop = makeBillboard(); dist = off + 6 + rng() * 4; }
      if (!prop) continue;
      const px = c.x + n.x * dist * side;
      const pz = c.z + n.z * dist * side;
      // Skip if this spot is actually close to another part of the track
      // (prevents props popping up on a loop-back through tight curves).
      if (this._minDistToTrackSq(px, pz) < propClear2) continue;
      prop.position.set(px, 0, pz);
      prop.rotation.y = Math.atan2(t.x, t.z);
      prop.userData.scenery = true;
      this.group.add(prop);
    }
  }

  // Dashed center line down the middle of the road for a livelier track read.
  _buildCenterLine() {
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.05,
    });
    const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 3.2);
    const step = 14; // spacing between dashes (in samples)
    for (let i = 0; i < this.N; i += step) {
      const c = this.samples[i];
      const t = this.tangents[i];
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(c.x, 0.06, c.z);
      dash.rotation.y = Math.atan2(t.x, t.z);
      this.group.add(dash);
    }
  }

  // Two boost strips per lap, away from the start line.
  _buildBoostZones() {
    this.boostZones = [];
    for (const f of [0.34, 0.69]) {
      const c = Math.floor(f * this.N);
      this.boostZones.push({ from: c - 7, to: c + 7 });
    }
  }

  isBoostZone(idx) {
    if (!this.boostZones) return false;
    for (const z of this.boostZones) if (idx >= z.from && idx <= z.to) return true;
    return false;
  }

  _buildBoostPads() {
    this._buildBoostZones();
    this.boostArrows = [];
    for (const z of this.boostZones) {
      const center = Math.floor((z.from + z.to) / 2);
      for (let j = -2; j <= 2; j++) {
        const idx = ((center + j * 4) % this.N + this.N) % this.N;
        const c = this.samples[idx];
        const t = this.tangents[idx];
        const n = this.normals[idx];
        const arrow = new THREE.Group();
        // each chevron has its own material so it can pulse independently
        const mat = new THREE.MeshStandardMaterial({
          color: 0x00f5d4, emissive: 0x00f5d4, emissiveIntensity: 1.0, roughness: 0.3,
        });
        // a wide flat chevron (two angled bars) lying on the road
        for (const sx of [-1, 1]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.9), mat);
          bar.position.set(sx * 1.0, 0, 0.0);
          bar.rotation.y = sx * 0.6; // angle the two bars into a ">" shape
          arrow.add(bar);
        }
        arrow.position.set(c.x, 0.12, c.z);
        arrow.rotation.y = Math.atan2(t.x, t.z);
        this.group.add(arrow);
        this.boostArrows.push({ mesh: arrow, mat, phase: j * 0.4, baseY: 0.12 });
      }
    }
  }

  _buildEnvironment() {
    // Ground with a subtle two-tone checker pattern (livelier than flat color).
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const base = new THREE.Color(this.theme.ground);
    const lite = base.clone().lerp(new THREE.Color(0xffffff), 0.08);
    const dark = base.clone().lerp(new THREE.Color(0x000000), 0.08);
    const toCss = (col) => `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? toCss(lite) : toCss(dark);
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(120, 120);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  _buildRoad() {
    const positions = [];
    const indices = [];
    const colorRoad = new THREE.Color(this.theme.road);
    const colors = [];

    for (let i = 0; i <= this.N; i++) {
      const idx = i % this.N;
      const c = this.samples[idx];
      const n = this.normals[idx];
      const left = new THREE.Vector3().copy(c).addScaledVector(n, this.halfWidth);
      const right = new THREE.Vector3().copy(c).addScaledVector(n, -this.halfWidth);
      positions.push(left.x, 0.04, left.z);
      positions.push(right.x, 0.04, right.z);
      colors.push(colorRoad.r, colorRoad.g, colorRoad.b);
      colors.push(colorRoad.r, colorRoad.g, colorRoad.b);
    }
    for (let i = 0; i < this.N; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    road.receiveShadow = true;
    this.group.add(road);

    // Curbs: striped ribbons along both edges
    this._buildCurb(this.halfWidth, this.theme.curb);
    this._buildCurb(-this.halfWidth, this.theme.curb);
  }

  _buildCurb(offset, color) {
    const positions = [];
    const indices = [];
    const colors = [];
    const w = 1.1; // curb width
    const cA = new THREE.Color(color);
    const cB = new THREE.Color(0xffffff);
    for (let i = 0; i <= this.N; i++) {
      const idx = i % this.N;
      const c = this.samples[idx];
      const n = this.normals[idx];
      const sign = offset > 0 ? 1 : -1;
      const inner = new THREE.Vector3().copy(c).addScaledVector(n, offset);
      const outer = new THREE.Vector3().copy(c).addScaledVector(n, offset + sign * w);
      positions.push(inner.x, 0.06, inner.z);
      positions.push(outer.x, 0.06, outer.z);
      const col = i % 2 === 0 ? cA : cB;
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
    for (let i = 0; i < this.N; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const curb = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    this.group.add(curb);
  }

  _buildStartLine() {
    // Checkered start/finish stripe at sample 0
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const s = 16;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#1a1a1a';
      ctx.fillRect(x * s, y * s, s, s);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(this.width / 3, 1);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width, 3),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    );
    plane.rotation.x = -Math.PI / 2;
    const c = this.samples[0];
    const t = this.tangents[0];
    plane.position.set(c.x, 0.07, c.z);
    plane.rotation.z = Math.atan2(t.x, t.z);
    this.group.add(plane);
    this.startPos = c.clone();
    this.startHeading = Math.atan2(t.x, t.z);
  }

  // Posts + fence rail running alongside both edges of the track.
  _buildFences() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const postMat = new THREE.MeshStandardMaterial({ color: this.theme.curb, roughness: 0.6 });
    const step = 10;            // every Nth sample gets a post
    const off = this.halfWidth + 1.6;
    const postGeo = new THREE.BoxGeometry(0.3, 1.4, 0.3);
    for (let side = -1; side <= 1; side += 2) {
      const railPositions = [];
      for (let i = 0; i < this.N; i += step) {
        const c = this.samples[i];
        const n = this.normals[i];
        const px = c.x + n.x * off * side;
        const pz = c.z + n.z * off * side;
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0.7, pz);
        this.group.add(post);
        railPositions.push(new THREE.Vector3(px, 1.15, pz));
      }
      // continuous rail (thin tube via small box segments)
      for (let i = 0; i < railPositions.length; i++) {
        const a = railPositions[i];
        const b = railPositions[(i + 1) % railPositions.length];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len > 30) continue; // skip the closing wrap gap
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.18), railMat);
        rail.position.set((a.x + b.x) / 2, 1.15, (a.z + b.z) / 2);
        rail.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        this.group.add(rail);
      }
    }
  }

  // Big arch over the start/finish line with a checkered banner.
  _buildStartGantry() {
    const c = this.samples[0];
    const t = this.tangents[0];
    const n = this.normals[0];
    const heading = Math.atan2(t.x, t.z);
    const span = this.width + 4;

    const g = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0xe33b5a, roughness: 0.5, metalness: 0.2 });
    const legGeo = new THREE.CylinderGeometry(0.4, 0.5, 9, 10);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(n.x * (span / 2) * side, 4.5, n.z * (span / 2) * side);
      g.add(leg);
    }
    // top beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 1.4, 1.2), legMat);
    beam.position.set(0, 9, 0);
    beam.rotation.y = heading;
    g.add(beam);
    // checkered banner under the beam
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const sq = 16;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#1a1a1a';
      ctx.fillRect(x * sq, y * sq, sq, sq);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(span, 2.2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide })
    );
    banner.position.set(0, 7.4, 0);
    banner.rotation.y = heading;
    g.add(banner);

    g.position.set(c.x, 0, c.z);
    this.group.add(g);
  }

  // Grandstands with tiered seating and a dense, colorful crowd.
  _buildGrandstands() {
    this.crowd = [];        // animated spectators (the "wave")
    this.flags = [];        // tremulating flags
    const standMat = new THREE.MeshStandardMaterial({ color: 0xcacfda, roughness: 0.9 });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x9aa1b2, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: this.theme.curb, roughness: 0.6, metalness: 0.2 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const crowdColors = [0xff5a5f, 0xffd23f, 0x3d8bff, 0x2ec4b6, 0xffffff, 0xff7ad1, 0x9b5de5, 0xff9f1c, 0x4dd2ff];
    const crowdGeo = new THREE.SphereGeometry(0.42, 6, 5);
    const headGeo = new THREE.SphereGeometry(0.26, 6, 5);

    const place = (startIdx, side) => {
      const idx = ((startIdx % this.N) + this.N) % this.N;
      const t = this.tangents[idx];
      const heading = Math.atan2(t.x, t.z);
      // Guarantee the whole stand sits clear of every part of the track.
      const spot = this._placeOutside(idx, side, this.halfWidth + 12, this.halfWidth + 22);
      if (!spot) return; // no clear room at this spot (tight curve) -> skip
      const bx = spot.x;
      const bz = spot.z;

      const stand = new THREE.Group();
      const WIDTH = 26;
      const TIERS = 5;

      // Stepped seating tiers (each higher row set further back)
      for (let r = 0; r < TIERS; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 0.9, 1.7), r % 2 ? stepMat : standMat);
        step.position.set(0, 1.0 + r * 0.95, 2.6 - r * 1.5);
        stand.add(step);

        // Crowd on each tier: rows of bodies + heads, colorful
        const seats = 17;
        for (let s = 0; s < seats; s++) {
          const cx = -WIDTH / 2 + 0.9 + s * ((WIDTH - 1.8) / (seats - 1)) + (r % 2) * 0.4;
          const colBody = crowdColors[(r * 7 + s) % crowdColors.length];
          const body = new THREE.Mesh(crowdGeo, new THREE.MeshStandardMaterial({ color: colBody, roughness: 0.85 }));
          const yy = 1.7 + r * 0.95;
          const zz = 2.6 - r * 1.5;
          body.position.set(cx, yy, zz);
          body.scale.set(1, 1.15, 1);
          stand.add(body);
          const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffd9a8, roughness: 0.85 }));
          head.position.set(cx, yy + 0.5, zz);
          stand.add(head);
          // register for the "wave": phase depends on seat column so the
          // jump ripples across the stand.
          this._crowdPending = this._crowdPending || [];
          this._crowdPending.push({ body, head, baseY: yy, headBaseY: yy + 0.5, phase: s * 0.5 + r * 0.2 });
        }
      }

      // Side walls
      for (const sx of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 9), standMat);
        wall.position.set(sx * WIDTH / 2, 2.7, -0.5);
        stand.add(wall);
      }

      // Canopy roof on poles
      const roof = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 2, 0.5, 10), roofMat);
      roof.position.set(0, 7.4, -1.5);
      roof.rotation.x = -0.12;
      stand.add(roof);
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7.4, 8), poleMat);
        pole.position.set(sx * (WIDTH / 2 - 1), 3.7, -5);
        stand.add(pole);
      }

      // Flags on tall poles atop the stand (tremulate in the update loop)
      const flagColors = [this.theme.curb, 0xffffff, this.theme.decoColor];
      for (let f = -1; f <= 1; f++) {
        const fx = f * (WIDTH / 2 - 2);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), poleMat);
        mast.position.set(fx, 9.6, -2);
        stand.add(mast);
        const flagMat = new THREE.MeshStandardMaterial({ color: flagColors[(f + 1) % flagColors.length], roughness: 0.7, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), flagMat);
        flag.position.set(fx + 0.85, 11.0, -2);
        stand.add(flag);
        this.flags.push({ mesh: flag, phase: Math.random() * Math.PI * 2 });
      }

      // commit the pending crowd of this stand
      if (this._crowdPending) { for (const c of this._crowdPending) this.crowd.push(c); this._crowdPending = []; }

      stand.position.set(bx, 0, bz);
      stand.rotation.y = heading + (side < 0 ? Math.PI : 0);
      stand.userData.scenery = true;
      this.group.add(stand);
    };

    // Stands flanking the start straight + one more down the lap.
    place(8, 1);
    place(8, -1);
    place(this.N - 30, 1);
    place(Math.floor(this.N * 0.5), -1);
  }

  _buildDecorations() {
    const type = this.theme.deco;
    const color = this.theme.decoColor;
    const rng = mulberry32(0xC0FFEE ^ hashStr(this.def.id));
    const count = 120;
    const makeOne = () => {
      const g = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
      const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
      if (type === 'tree' || type === 'pine') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 7), trunkMat);
        trunk.position.y = 1; g.add(trunk);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, type === 'pine' ? 4 : 2.6, 9), leafMat);
        top.position.y = type === 'pine' ? 3.4 : 2.8; g.add(top);
        if (type === 'pine') {
          const top2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 9), leafMat);
          top2.position.y = 4.6; g.add(top2);
        }
      } else if (type === 'palm') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 7), trunkMat);
        trunk.position.y = 1.7; g.add(trunk);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), leafMat);
        crown.scale.set(1.4, 0.5, 1.4); crown.position.y = 3.6; g.add(crown);
      } else if (type === 'rock') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), leafMat);
        rock.position.y = 0.8; rock.scale.y = 0.8; g.add(rock);
      } else if (type === 'pylon' || type === 'star') {
        const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4 });
        const shape = type === 'star'
          ? new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), m)
          : new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.2, 6), m);
        shape.position.y = 1.6; g.add(shape);
      } else { // bush
        const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), leafMat);
        b.position.y = 0.8; b.scale.y = 0.8; g.add(b);
      }
      return g;
    };

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * this.N);
      const side = rng() < 0.5 ? 1 : -1;
      const dist = this.halfWidth + 5 + rng() * 40;
      const c = this.samples[idx];
      const n = this.normals[idx];
      const x = c.x + n.x * dist * side;
      const z = c.z + n.z * dist * side;
      // keep scenery off the track even where the loop comes back around
      const clear = this.halfWidth + 3;
      if (this._minDistToTrackSq(x, z) < clear * clear) continue;
      const d = makeOne();
      d.position.set(x, 0, z);
      const s = 0.7 + rng() * 0.9;
      d.scale.setScalar(s);
      d.rotation.y = rng() * Math.PI * 2;
      d.userData.scenery = true;
      this.group.add(d);
    }
  }

  // Find nearest sample to a position, searching a window around lastIndex.
  // Returns { index, lateral, tangent }. lateral is signed distance along normal.
  nearest(pos, lastIndex = 0) {
    let best = lastIndex;
    let bestD = Infinity;
    for (let di = -12; di <= 45; di++) {
      const idx = ((lastIndex + di) % this.N + this.N) % this.N;
      const s = this.samples[idx];
      const dx = pos.x - s.x, dz = pos.z - s.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = idx; }
    }
    const s = this.samples[best];
    const n = this.normals[best];
    const lateral = (pos.x - s.x) * n.x + (pos.z - s.z) * n.z;
    return { index: best, lateral, tangent: this.tangents[best], sample: s, normal: n };
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}

// Small deterministic RNG so decorations are stable per track.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
