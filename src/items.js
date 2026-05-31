// KARTOPIA - item world objects: item boxes + projectiles (banana, shell).
// The roulette/holding/AI-use logic lives in game.js; this manages the world.
import * as THREE from 'three';

const SHELL_SPEED = 55;

export class ItemSystem {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.boxes = [];
    this.projectiles = [];
    this.coins = [];
    this._buildBoxes();
    this._buildCoins();
  }

  // Collectible gold coins scattered along the racing line. Picking one up
  // gives a tiny speed nudge and feeds the coin economy (via onCoin).
  _buildCoins() {
    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16);
    // place a coin roughly every ~25 samples, skipping near item boxes
    const step = 25;
    for (let idx = 12; idx < this.track.N; idx += step) {
      // a short arc of 3 coins for a nice "collect the line" feel
      for (let j = 0; j < 3; j++) {
        const si = (idx + j * 3) % this.track.N;
        const c = this.track.samples[si];
        const n = this.track.normals[si];
        const lateral = (Math.sin(idx * 0.7) * 0.5) * this.track.halfWidth * 0.5; // gentle weave
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffd23f, emissive: 0xb8860b, emissiveIntensity: 0.5,
          metalness: 0.7, roughness: 0.25,
        });
        const mesh = new THREE.Mesh(coinGeo, mat);
        mesh.rotation.x = Math.PI / 2; // face up like a spinning coin
        const pos = new THREE.Vector3(c.x + n.x * lateral, 0.9, c.z + n.z * lateral);
        mesh.position.copy(pos);
        this.group.add(mesh);
        this.coins.push({ mesh, pos, active: true, respawn: 0, spin: Math.random() * Math.PI * 2 });
      }
    }
  }

  _buildBoxes() {
    // Shared geometries for a prettier item box: a faceted floating crystal
    // (octahedron) with a glowing aura and a "?" mark on each face.
    const crystalGeo = new THREE.OctahedronGeometry(1.05, 0);
    const auraGeo = new THREE.OctahedronGeometry(1.35, 0);
    const qTex = this._makeQuestionTexture();

    const fractions = [0.12, 0.45, 0.82];
    const offsets = [-4.5, 0, 4.5];
    for (const f of fractions) {
      const idx = Math.floor(f * this.track.N);
      const c = this.track.samples[idx];
      const n = this.track.normals[idx];
      for (const off of offsets) {
        const g = new THREE.Group();

        // glossy colored crystal
        const crystalMat = new THREE.MeshStandardMaterial({
          map: qTex, color: 0xffffff,
          emissive: 0x33aaff, emissiveIntensity: 0.45,
          roughness: 0.25, metalness: 0.35,
          transparent: true, opacity: 0.95,
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        g.add(crystal);

        // soft glowing aura shell (additive-ish, no depth write)
        const auraMat = new THREE.MeshBasicMaterial({
          color: 0x66e0ff, transparent: true, opacity: 0.18, depthWrite: false,
        });
        const aura = new THREE.Mesh(auraGeo, auraMat);
        g.add(aura);

        const pos = new THREE.Vector3(c.x + n.x * off, 1.5, c.z + n.z * off);
        g.position.copy(pos);
        this.group.add(g);
        this.boxes.push({
          mesh: g, crystal, aura, pos,
          active: true, respawn: 0,
          spin: Math.random() * Math.PI * 2,
          hue: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  // A canvas texture: translucent panel with a bold yellow "?" mark.
  _makeQuestionTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b6fff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 4, 56, 56);
    ctx.fillStyle = '#ff8c00';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 32, 36);
    return new THREE.CanvasTexture(canvas);
  }

  // Returns array of karts that just grabbed a box (and are free to receive an item).
  update(dt, karts, time) {
    const pickups = [];
    for (const box of this.boxes) {
      if (box.active) {
        // lively animation: spin on two axes, float up/down, pulse the aura,
        // and slowly shift the emissive color through the rainbow.
        box.spin += dt;
        box.mesh.rotation.y += dt * 1.6;
        box.mesh.rotation.x = Math.sin(box.spin * 0.8) * 0.4;
        box.mesh.position.y = box.pos.y + Math.sin(box.spin * 2 + box.pos.x) * 0.25;
        const grow = 1 + Math.sin(box.spin * 3) * 0.06;
        box.crystal.scale.setScalar(grow);
        const auraPulse = 1 + Math.sin(box.spin * 2.5) * 0.12;
        box.aura.scale.setScalar(auraPulse);
        box.aura.material.opacity = 0.14 + (Math.sin(box.spin * 2.5) + 1) * 0.05;
        box.hue += dt * 0.6;
        const r = Math.sin(box.hue) * 0.5 + 0.5;
        const gr = Math.sin(box.hue + 2.1) * 0.5 + 0.5;
        const b = Math.sin(box.hue + 4.2) * 0.5 + 0.5;
        box.crystal.material.emissive.setRGB(r * 0.5, gr * 0.6, b);
        // grow back in after respawning
        if (box.popIn > 0) {
          box.popIn -= dt;
          const s = Math.max(0.01, 1 - box.popIn / 0.4);
          box.mesh.scale.setScalar(s);
          if (box.popIn <= 0) box.mesh.scale.setScalar(1);
        }
        for (const k of karts) {
          if (k.finished || k.heldItem || k.roulette > 0) continue;
          if (dist2(k.pos, box.pos) < 9) {
            box.active = false;
            box.respawn = 4;
            box.mesh.visible = false;
            if (this.onBoxGrab) this.onBoxGrab(box.pos); // pickup FX
            pickups.push(k);
            break;
          }
        }
      } else {
        box.respawn -= dt;
        if (box.respawn <= 0) {
          box.active = true;
          box.mesh.visible = true;
          box.popIn = 0.4; // pop-in grow animation
          box.mesh.scale.setScalar(0.01);
        }
      }
    }

    // Coins: spin, bob, and get collected by any kart that touches them.
    for (const coin of this.coins) {
      if (coin.active) {
        coin.spin += dt;
        coin.mesh.rotation.z = coin.spin * 3;
        coin.mesh.position.y = coin.pos.y + Math.sin(coin.spin * 3) * 0.15;
        for (const k of karts) {
          if (k.finished) continue;
          if (dist2(k.pos, coin.pos) < 6.25) { // 2.5u radius
            coin.active = false;
            coin.respawn = 6;
            coin.mesh.visible = false;
            if (k.collectCoin) k.collectCoin();
            if (this.onCoin) this.onCoin(k, coin.pos);
            break;
          }
        }
      } else {
        coin.respawn -= dt;
        if (coin.respawn <= 0) { coin.active = true; coin.mesh.visible = true; }
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      let remove = p.life <= 0;

      if (p.type === 'shell' && !remove) {
        p.pos.x += p.vel.x * dt;
        p.pos.z += p.vel.z * dt;
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.y += dt * 10;
        const info = this.track.nearest(p.pos, p.seg);
        p.seg = info.index;
        if (Math.abs(info.lateral) > this.track.halfWidth + this.track.wallMargin) remove = true;
      } else if (p.type === 'banana' && !remove) {
        p.arm -= dt;
        p.mesh.rotation.y += dt * 1.5;
      } else if (p.type === 'oil' && !remove) {
        // oil slick just sits there, shimmering
        p.mesh.rotation.z += dt * 0.5;
      } else if (p.type === 'bomb' && !remove) {
        p.fuse -= dt;
        // pulse faster as the fuse runs down
        const pulse = 1 + Math.sin(this.bombTime = (this.bombTime || 0) + dt * (8 + (3 - p.fuse) * 6)) * 0.15;
        p.mesh.scale.setScalar(pulse);
        if (p.fuse <= 0) {
          // explode: area damage to any kart nearby, then remove
          for (const k of karts) {
            if (k.finished) continue;
            if (dist2(k.pos, p.pos) < 64) { // 8u radius
              k.spinOut(1.5);
              if (this.onHit) this.onHit(k, 'bomb');
            }
          }
          if (this.onExplode) this.onExplode(p.pos);
          remove = true;
        }
      }

      if (!remove && (p.type === 'banana' || p.type === 'shell' || p.type === 'oil')) {
        for (const k of karts) {
          if (k.finished) continue;
          if (p.type === 'banana' && k === p.owner && p.arm > 0) continue;
          if (p.type === 'shell' && k === p.owner) continue;
          if (p.type === 'oil' && k === p.owner && p.arm > 0) continue;
          const hitR = p.type === 'shell' ? 5.0 : p.type === 'oil' ? 6.0 : 4.0;
          if (dist2(k.pos, p.pos) < hitR) {
            k.spinOut(p.type === 'shell' ? 1.3 : p.type === 'oil' ? 1.0 : 1.2);
            if (this.onHit) this.onHit(k, p.type);
            // oil is a slick: stays on the track and can catch several karts,
            // so it is NOT removed on hit (it expires by its own life timer).
            if (p.type !== 'oil') remove = true;
            break;
          }
        }
      }

      if (remove) { this._removeMesh(p.mesh); this.projectiles.splice(i, 1); }
    }

    return pickups;
  }

  dropBanana(kart) {
    const fwd = kart.forward();
    const pos = new THREE.Vector3(kart.pos.x - fwd.x * 2.4, 0.45, kart.pos.z - fwd.z * 2.4);
    const g = new THREE.Group();
    const peelMat = new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0x6b5e00, emissiveIntensity: 0.25, roughness: 0.45 });
    // curved banana body: a few tapering segments along an arc
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1) - 0.5;          // -0.5..0.5
      const r = 0.22 * (1 - Math.abs(t) * 1.2); // taper at the tips
      const seg = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.06, r), 8, 8), peelMat);
      seg.position.set(t * 1.2, Math.cos(t * Math.PI) * 0.28 - 0.1, 0);
      g.add(seg);
    }
    // little dark tips
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x6b4a12, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), tipMat);
      tip.position.set(sx * 0.62, -0.05, 0);
      g.add(tip);
    }
    g.position.copy(pos);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(g);
    this.projectiles.push({ type: 'banana', pos, mesh: g, owner: kart, life: 22, arm: 0.7 });
  }

  fireShell(kart) {
    const fwd = kart.forward();
    const pos = new THREE.Vector3(kart.pos.x + fwd.x * 2.6, 0.6, kart.pos.z + fwd.z * 2.6);
    const g = new THREE.Group();
    // green shell: glossy dome + pale belly + dark rim
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2fd35a, emissive: 0x0e7a32, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1 })
    );
    g.add(dome);
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.5 })
    );
    g.add(belly);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.08, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0x0e5a28, roughness: 0.5 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    g.add(rim);
    g.scale.set(1, 0.85, 1);
    g.position.copy(pos);
    this.group.add(g);
    this.projectiles.push({
      type: 'shell', pos, mesh: g, owner: kart, life: 3.0, seg: kart.segIndex,
      vel: { x: fwd.x * SHELL_SPEED, z: fwd.z * SHELL_SPEED },
    });
  }

  // Bomb: dropped behind, ticks down, then explodes with an area blast.
  dropBomb(kart) {
    const fwd = kart.forward();
    const pos = new THREE.Vector3(kart.pos.x - fwd.x * 2.6, 0.7, kart.pos.z - fwd.z * 2.6);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.4, emissive: 0x550000, emissiveIntensity: 0.4 })
    );
    g.add(body);
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff6600, emissiveIntensity: 0.8 })
    );
    fuse.position.y = 0.55;
    g.add(fuse);
    g.position.copy(pos);
    this.group.add(g);
    this.projectiles.push({ type: 'bomb', pos, mesh: g, owner: kart, life: 6, fuse: 2.2 });
  }

  // Oil slick: a flat puddle dropped behind that makes karts spin out.
  dropOil(kart) {
    const fwd = kart.forward();
    const pos = new THREE.Vector3(kart.pos.x - fwd.x * 2.6, 0.06, kart.pos.z - fwd.z * 2.6);
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.projectiles.push({ type: 'oil', pos, mesh, owner: kart, life: 16, arm: 0.6 });
  }

  _removeMesh(mesh) {
    this.group.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose(); }
    });
    this.boxes = [];
    this.projectiles = [];
    this.coins = [];
  }
}

function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}
