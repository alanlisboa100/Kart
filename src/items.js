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
    this._buildBoxes();
  }

  _buildBoxes() {
    const geo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const fractions = [0.12, 0.45, 0.82];
    const offsets = [-4.5, 0, 4.5];
    for (const f of fractions) {
      const idx = Math.floor(f * this.track.N);
      const c = this.track.samples[idx];
      const n = this.track.normals[idx];
      for (const off of offsets) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffe14d, emissive: 0xff8c00, emissiveIntensity: 0.5,
          roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.92,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const pos = new THREE.Vector3(c.x + n.x * off, 1.4, c.z + n.z * off);
        mesh.position.copy(pos);
        this.group.add(mesh);
        this.boxes.push({ mesh, pos, active: true, respawn: 0 });
      }
    }
  }

  // Returns array of karts that just grabbed a box (and are free to receive an item).
  update(dt, karts, time) {
    const pickups = [];
    for (const box of this.boxes) {
      if (box.active) {
        box.mesh.rotation.y += dt * 2;
        box.mesh.rotation.x += dt * 1.3;
        box.mesh.position.y = 1.4 + Math.sin(time * 3 + box.pos.x) * 0.18;
        for (const k of karts) {
          if (k.finished || k.heldItem || k.roulette > 0) continue;
          if (dist2(k.pos, box.pos) < 9) {
            box.active = false;
            box.respawn = 4;
            box.mesh.visible = false;
            pickups.push(k);
            break;
          }
        }
      } else {
        box.respawn -= dt;
        if (box.respawn <= 0) { box.active = true; box.mesh.visible = true; }
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
    const pos = new THREE.Vector3(kart.pos.x - fwd.x * 2.4, 0.4, kart.pos.z - fwd.z * 2.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffe14d, roughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), mat);
    mesh.scale.set(1.1, 0.55, 0.7);
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.projectiles.push({ type: 'banana', pos, mesh, owner: kart, life: 22, arm: 0.7 });
  }

  fireShell(kart) {
    const fwd = kart.forward();
    const pos = new THREE.Vector3(kart.pos.x + fwd.x * 2.6, 0.6, kart.pos.z + fwd.z * 2.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2fd35a, emissive: 0x0e7a32, emissiveIntensity: 0.3, roughness: 0.4 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 12), mat);
    mesh.scale.set(1, 0.8, 1);
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.projectiles.push({
      type: 'shell', pos, mesh, owner: kart, life: 3.0, seg: kart.segIndex,
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
  }
}

function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}
