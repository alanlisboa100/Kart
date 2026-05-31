// KARTOPIA - lightweight particle FX (impact bursts, dust) using a small pool of
// billboard-ish meshes. Cheap enough for phones; reused via an object pool.
import * as THREE from 'three';

export class FXSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.pool = [];
    this.live = [];
    const geo = new THREE.SphereGeometry(0.35, 6, 5);
    for (let i = 0; i < 60; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.group.add(m);
      this.pool.push(m);
    }
  }

  _take() {
    const m = this.pool.pop();
    if (m) { m.visible = true; this.live.push(m); }
    return m;
  }

  // Burst of n particles at pos, tinted by color, flying outward.
  burst(pos, color = 0xffd23f, n = 12, speed = 10) {
    for (let i = 0; i < n; i++) {
      const m = this._take();
      if (!m) break;
      m.material.color.setHex(color);
      m.material.opacity = 1;
      m.position.set(pos.x, pos.y + 0.6, pos.z);
      const ang = Math.random() * Math.PI * 2;
      const up = 4 + Math.random() * speed;
      const out = (0.5 + Math.random()) * speed;
      m.userData.vx = Math.cos(ang) * out;
      m.userData.vy = up;
      m.userData.vz = Math.sin(ang) * out;
      m.userData.life = 0.5 + Math.random() * 0.4;
      m.userData.maxLife = m.userData.life;
      const s = 0.5 + Math.random() * 0.8;
      m.scale.setScalar(s);
    }
  }

  // A quick ring/flash for emphasis (uses a few big fading particles)
  flash(pos, color = 0xffffff) {
    this.burst(pos, color, 6, 6);
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const m = this.live[i];
      const u = m.userData;
      u.life -= dt;
      if (u.life <= 0) {
        m.visible = false;
        this.live.splice(i, 1);
        this.pool.push(m);
        continue;
      }
      u.vy -= 22 * dt; // gravity
      m.position.x += u.vx * dt;
      m.position.y += u.vy * dt;
      m.position.z += u.vz * dt;
      if (m.position.y < 0.1) { m.position.y = 0.1; u.vy *= -0.4; u.vx *= 0.7; u.vz *= 0.7; }
      m.material.opacity = Math.max(0, u.life / u.maxLife);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.pool = [];
    this.live = [];
  }
}
