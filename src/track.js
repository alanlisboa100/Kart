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
    this._buildStartLine();
    this._buildStartGantry();
    this._buildGrandstands();
    this._buildBoostPads();
    this._buildDecorations();
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
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4, emissive: 0x00b4a0, emissiveIntensity: 0.8, roughness: 0.4,
    });
    for (const z of this.boostZones) {
      const center = Math.floor((z.from + z.to) / 2);
      for (let j = -1; j <= 1; j++) {
        const idx = ((center + j * 4) % this.N + this.N) % this.N;
        const c = this.samples[idx];
        const t = this.tangents[idx];
        const arrow = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.0, 4), arrowMat);
        cone.rotation.x = Math.PI / 2; // tip points forward (+Z local)
        arrow.add(cone);
        arrow.position.set(c.x, 0.09, c.z);
        arrow.rotation.y = Math.atan2(t.x, t.z);
        this.group.add(arrow);
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
    const standMat = new THREE.MeshStandardMaterial({ color: 0xcacfda, roughness: 0.9 });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x9aa1b2, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: this.theme.curb, roughness: 0.6, metalness: 0.2 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const crowdColors = [0xff5a5f, 0xffd23f, 0x3d8bff, 0x2ec4b6, 0xffffff, 0xff7ad1, 0x9b5de5, 0xff9f1c, 0x4dd2ff];
    const crowdGeo = new THREE.SphereGeometry(0.42, 6, 5);
    const headGeo = new THREE.SphereGeometry(0.26, 6, 5);

    const place = (startIdx, side) => {
      const idx = ((startIdx % this.N) + this.N) % this.N;
      const c = this.samples[idx];
      const n = this.normals[idx];
      const t = this.tangents[idx];
      const off = this.halfWidth + 10;
      const bx = c.x + n.x * off * side;
      const bz = c.z + n.z * off * side;
      const heading = Math.atan2(t.x, t.z);

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

      stand.position.set(bx, 0, bz);
      stand.rotation.y = heading + (side < 0 ? Math.PI : 0);
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
      const d = makeOne();
      d.position.set(c.x + n.x * dist * side, 0, c.z + n.z * dist * side);
      const s = 0.7 + rng() * 0.9;
      d.scale.setScalar(s);
      d.rotation.y = rng() * Math.PI * 2;
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
