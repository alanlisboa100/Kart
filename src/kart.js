// KARTOPIA - Kart: arcade physics with drift + mini-turbo, plus visuals.
import * as THREE from 'three';
import { buildCharacter, buildKart } from './builders.js';

const TMP = new THREE.Vector3();

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Kart {
  constructor(scene, charDef, kartDef, { isPlayer = false } = {}) {
    this.scene = scene;
    this.charDef = charDef;
    this.kartDef = kartDef;
    this.isPlayer = isPlayer;

    // Derived stats (0..10ish) -> tuning
    const speedStat = charDef.speed + kartDef.dSpeed;
    const accelStat = charDef.accel + kartDef.dAccel;
    const handStat = charDef.handling + kartDef.dHandling;

    this.maxSpeed = 44 + speedStat * 1.4;        // top speed
    this.accel = 22 + accelStat * 1.8;           // base accel (curve eases it in)
    this.brakeDecel = 58;
    this.turnRate = 2.15 + handStat * 0.12;      // rad/s
    this.grip = 0.86 + handStat * 0.008;

    // Visual
    const built = buildKart(kartDef);
    this.mesh = built.group;
    this.wheels = built.wheels;
    this.frontWheels = built.frontWheels;
    this.flame = built.flame;
    this.sparks = built.sparks || [];
    this.steeringWheel = built.steeringWheel || null;
    const driver = buildCharacter(charDef);
    driver.position.set(0, 0.35, -0.35);
    driver.scale.setScalar(0.85);
    this.driver = driver;
    this.mesh.add(driver);
    scene.add(this.mesh);

    // Physics state
    this.pos = new THREE.Vector3();
    this.heading = 0;       // yaw, forward = (sin h, 0, cos h)
    this.speed = 0;
    this.visualYaw = 0;     // extra yaw for drift slide look
    this.lean = 0;
    this.steerSmooth = 0;   // smoothed steering axis for buttery turns
    this.bob = Math.random() * Math.PI * 2; // idle bob phase
    this.bobOffset = 0;

    // Drift state
    this.drifting = false;
    this.driftDir = 0;      // -1 left, +1 right
    this.driftCharge = 0;   // seconds held
    this.boostTimer = 0;

    // Items / status effects
    this.heldItem = null;   // 'banana' | 'shell' | 'boost' | 'lightning' | null
    this.roulette = 0;      // >0 while the item box roulette is spinning
    this.aiItemTimer = 0;   // AI delay before using a held item
    this.spin = 0;          // spin-out time remaining (lost control)
    this.spinAngle = 0;     // visual spin rotation
    this.shrink = 0;        // lightning shrink/slow time remaining
    this.shield = 0;        // shield time remaining (blocks one hit)
    this.shieldMesh = built.shield || null; // visual bubble (hidden by default)

    // Race progress
    this.segIndex = 0;
    this.lap = 0;
    this.passedHalf = false; // gate: must pass mid-track before a lap counts
    this.progress = 0;       // lap + segIndex/N  (for ranking)
    this.finished = false;
    this.finishTime = 0;
    this.place = 0;

    // Rubber-banding multiplier on top speed (1 = normal). Game sets this for
    // AI karts each frame so trailing rivals can catch up and leaders ease off.
    this.rubber = 1;

    // Coins collected this race (classic kart speed-stacking mechanic).
    this.coins = 0;
  }

  // Collect a track coin: tiny instant nudge + a small lasting top-speed bonus
  // that stacks up to 10 coins (then resets each race).
  collectCoin() {
    this.coins = Math.min(10, this.coins + 1);
    this.speed += 1.5; // small instant pop
  }

  placeAt(pos, heading) {
    this.pos.copy(pos);
    this.heading = heading;
    this.speed = 0;
    this.drifting = false;
    this.driftCharge = 0;
    this.boostTimer = 0;
    this.lap = 0;
    this.passedHalf = false;
    this.finished = false;
    this.progress = 0;
    this.heldItem = null;
    this.roulette = 0;
    this.aiItemTimer = 0;
    this.spin = 0;
    this.spinAngle = 0;
    this.shrink = 0;
    this.shield = 0;
    this.steerSmooth = 0;
    this.coins = 0;
    this.mesh.scale.setScalar(1);
    this._updateShieldVisual();
    this._applyTransform();
  }

  forward() {
    return TMP.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // input: { throttle, brake, steer, drift }
  update(dt, input, track) {
    if (this.finished) input = { throttle: 0.0, brake: 0, steer: 0, drift: false };

    // --- Status: spin-out removes control ---
    if (this.spin > 0) {
      this.spin -= dt;
      this.spinAngle += dt * 16;
      this.speed *= 0.95;
      input = { throttle: 0, brake: 0, steer: 0, drift: false };
      if (this.drifting) this._releaseDrift();
    } else if (this.spinAngle !== 0) {
      this.spinAngle = 0;
    }

    // --- Status: lightning shrink slows the kart ---
    const shrunk = this.shrink > 0;
    if (shrunk) this.shrink -= dt;
    // Coins give a small top-speed bonus (up to +5% at 10 coins).
    const coinBonus = 1 + (this.coins || 0) * 0.005;
    const baseMax = this.maxSpeed * (shrunk ? 0.55 : 1) * (this.rubber || 1) * coinBonus;

    // --- Status: shield timer + spinning bubble visual ---
    if (this.shield > 0) {
      this.shield -= dt;
      if (this.shield <= 0) this._updateShieldVisual();
      else if (this.shieldMesh) { this.shieldMesh.visible = true; this.shieldMesh.rotation.y += dt * 3; }
    }

    // --- Longitudinal ---
    // Gradual acceleration with a smooth curve: strong pull off the line, then
    // easing as we approach top speed (asymptotic) so it has real "weight".
    const boosting = this.boostTimer > 0;
    const targetMax = boosting ? baseMax * 1.4 : baseMax;
    if (input.throttle > 0) {
      const ratio = THREE.MathUtils.clamp(this.speed / targetMax, 0, 1);
      // accel fades from 100% near standstill to ~12% near top speed
      const curve = 1 - ratio * ratio * 0.88;
      this.speed += this.accel * input.throttle * curve * dt;
      if (boosting) this.speed += this.accel * 0.4 * dt; // boost overrides the fade
    } else if (input.brake > 0) {
      // Progressive braking: stronger the faster you go, eased near a stop.
      const b = this.brakeDecel * (0.5 + 0.5 * THREE.MathUtils.clamp(this.speed / this.maxSpeed, 0, 1));
      this.speed -= b * input.brake * dt;
    } else {
      // natural engine drag (coasting)
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 14 * dt);
    }
    // clamp
    const minSpeed = -this.maxSpeed * 0.35;
    this.speed = Math.max(minSpeed, Math.min(targetMax, this.speed));
    if (this.boostTimer > 0) this.boostTimer -= dt;

    // --- Steering ---
    // turn influence scales with speed and direction of travel
    const turnInfluence = THREE.MathUtils.clamp(this.speed / 7, -1, 1);
    // Smooth the raw steer axis toward its target for buttery, non-twitchy turns.
    // Snappier toward extremes, gentle return to center.
    const rawSteer = THREE.MathUtils.clamp(input.steer, -1, 1);
    const smoothK = 1 - Math.pow(0.0009, dt); // frame-rate independent (~0.5 @60fps)
    this.steerSmooth += (rawSteer - this.steerSmooth) * smoothK;
    if (Math.abs(this.steerSmooth) < 0.003) this.steerSmooth = 0;
    let steer = this.steerSmooth;

    // --- Drift handling ---
    const canDrift = Math.abs(this.speed) > this.maxSpeed * 0.35;
    if (input.drift && canDrift) {
      if (!this.drifting && Math.abs(rawSteer) > 0.2) {
        this.drifting = true;
        this.driftDir = Math.sign(rawSteer);
        this.driftCharge = 0;
      }
    } else if (this.drifting) {
      this._releaseDrift();
    }

    let effTurn = this.turnRate;
    if (this.drifting) {
      // bias the turn toward the drift direction; steering modulates within a range
      const inward = THREE.MathUtils.clamp(steer * this.driftDir, -1, 1); // -1..1
      const turnAmt = THREE.MathUtils.lerp(0.55, 1.25, (inward + 1) / 2);
      this.heading += this.driftDir * effTurn * turnAmt * turnInfluence * dt;
      this.driftCharge += dt;
      // slight speed cost while drifting unless boosting
      if (!boosting) this.speed -= 1.5 * dt;
      // visual slide
      this.visualYaw = THREE.MathUtils.lerp(this.visualYaw, -this.driftDir * 0.5, 0.15);
      this.lean = THREE.MathUtils.lerp(this.lean, this.driftDir * 0.22, 0.15);
    } else {
      this.heading += steer * effTurn * turnInfluence * dt;
      this.visualYaw = THREE.MathUtils.lerp(this.visualYaw, 0, 0.15);
      this.lean = THREE.MathUtils.lerp(this.lean, -steer * 0.12 * turnInfluence, 0.12);
    }

    // --- Move ---
    const fwd = this.forward();
    this.pos.addScaledVector(fwd, this.speed * dt);

    // --- Track collision / off-road ---
    if (track) this._handleTrack(track, dt);

    // --- Wheels & visuals ---
    this._animate(dt, steer);
    this._applyTransform();
  }

  _releaseDrift() {
    // Mini-turbo tiers based on charge time
    let boost = 0;
    let color = 0x4dc3ff;
    if (this.driftCharge > 1.9) { boost = 1.5; color = 0xb14dff; }      // purple
    else if (this.driftCharge > 1.1) { boost = 1.1; color = 0xff9f1c; } // orange
    else if (this.driftCharge > 0.55) { boost = 0.7; color = 0x4dc3ff; } // blue
    if (boost > 0) {
      this.boostTimer = boost;
      this.speed = Math.max(this.speed, this.maxSpeed * 1.05);
      this.flame.material.color.setHex(color);
    }
    this.drifting = false;
    this.driftCharge = 0;
    this.driftDir = 0;
  }

  _handleTrack(track, dt) {
    const info = track.nearest(this.pos, this.segIndex);
    const absLat = Math.abs(info.lateral);

    // Off-road slowdown
    if (absLat > track.halfWidth) {
      const overTarget = this.maxSpeed * 0.45;
      if (this.speed > overTarget) this.speed -= 28 * dt;
    }
    // Wall: gently keep the kart inside and steer it parallel (no harsh impact).
    const limit = track.halfWidth + track.wallMargin;
    if (absLat > limit) {
      const sign = Math.sign(info.lateral) || 1;
      const correction = info.lateral - sign * limit;
      this.pos.x -= info.normal.x * correction;
      this.pos.z -= info.normal.z * correction;
      // Smoothly redirect along the track instead of slamming to a stop.
      const tangentHeading = Math.atan2(info.tangent.x, info.tangent.z);
      this.heading = angleLerp(this.heading, tangentHeading, 0.2);
      if (this.drifting) this._releaseDrift();
    }

    // --- Lap progress ---
    const prev = this.segIndex;
    const cur = info.index;
    this.segIndex = cur;
    // mark that we've gone through the far half of the lap
    if (cur > track.N * 0.4 && cur < track.N * 0.65) this.passedHalf = true;
    const forwardDot = this.forward().dot(info.tangent);
    // crossing the start/finish seam forward, but only counts if we did a real loop
    if (prev > track.N * 0.75 && cur < track.N * 0.25 && forwardDot > 0) {
      if (this.passedHalf) { this.lap += 1; this.passedHalf = false; }
    } else if (prev < track.N * 0.25 && cur > track.N * 0.75 && forwardDot < 0) {
      // went backward over the line
      this.lap = Math.max(0, this.lap - 1);
    }
    this.progress = this.lap + cur / track.N;

    // --- Boost pads ---
    if (track.isBoostZone && track.isBoostZone(cur) && Math.abs(info.lateral) < track.halfWidth) {
      this.boostTimer = Math.max(this.boostTimer, 0.45);
      this.flame.material.color.setHex(0x00f5d4);
    }
  }

  _animate(dt, steer) {
    const spin = this.speed * dt / 0.42; // wheel radius
    for (const w of this.wheels) w.rotation.x -= spin;
    for (const fw of this.frontWheels) fw.rotation.y = steer * 0.5;
    this.flame.visible = this.boostTimer > 0;
    if (this.flame.visible) {
      this.flame.scale.setScalar(0.8 + Math.random() * 0.5);
    }
    // Drift sparks, colored by mini-turbo tier
    const tier = this.driftTier;
    const sparkColor = tier >= 3 ? 0xb14dff : tier >= 2 ? 0xff9f1c : 0x4dc3ff;
    for (const s of this.sparks) {
      if (this.drifting && Math.abs(this.speed) > 4) {
        s.visible = true;
        s.material.color.setHex(sparkColor);
        s.scale.setScalar(0.6 + Math.random() * 0.9);
        s.material.opacity = 0.6 + Math.random() * 0.4;
      } else {
        s.visible = false;
      }
    }
    // Idle/road bob - subtle bounce that grows with speed
    this.bob += dt * (6 + Math.abs(this.speed) * 0.3);
    const bobAmt = Math.min(0.06, 0.02 + Math.abs(this.speed) * 0.0016);
    this.bobOffset = Math.sin(this.bob) * bobAmt;

    // Driver + steering wheel react to steering for a lively, hand-animated feel
    const steerVis = this.drifting ? this.driftDir : steer;
    if (this.steeringWheel) {
      // turn the wheel around its local up-ish axis (it's tilted ~1.1 rad on X)
      this.steeringWheel.rotation.y = THREE.MathUtils.lerp(
        this.steeringWheel.rotation.y, -steerVis * 0.6, 0.2);
    }
    if (this.driver) {
      // subtle body lean + head turn into the corner
      this.driver.rotation.z = THREE.MathUtils.lerp(this.driver.rotation.z, steerVis * 0.18, 0.15);
      this.driver.rotation.y = THREE.MathUtils.lerp(this.driver.rotation.y, -steerVis * 0.22, 0.15);
    }
  }

  _applyTransform() {
    this.mesh.position.copy(this.pos);
    this.mesh.position.y = this.pos.y + (this.bobOffset || 0);
    this.mesh.rotation.y = this.heading + this.visualYaw + this.spinAngle;
    this.mesh.rotation.z = this.lean;
    this.mesh.scale.setScalar(this.shrink > 0 ? 0.55 : 1);
  }

  // --- Item effects ---
  spinOut(dur = 1.2) {
    if (this.finished || this.spin > 0) return;
    if (this.shield > 0) { this.shield = 0; this._updateShieldVisual(); return; } // blocked!
    this.spin = dur;
    this.speed *= 0.35;
    this.boostTimer = 0;
    if (this.drifting) this._releaseDrift();
  }

  applyItemBoost(dur = 1.4) {
    this.boostTimer = Math.max(this.boostTimer, dur);
    this.speed = Math.max(this.speed, this.maxSpeed * 1.12);
    this.flame.material.color.setHex(0x00f5d4);
  }

  applyShrink(dur = 3) {
    if (this.finished) return;
    if (this.shield > 0) { this.shield = 0; this._updateShieldVisual(); return; } // blocked!
    this.shrink = Math.max(this.shrink, dur);
    this.speed *= 0.7;
    if (this.drifting) this._releaseDrift();
  }

  applyShield(dur = 6) {
    this.shield = Math.max(this.shield, dur);
    this._updateShieldVisual();
  }

  _updateShieldVisual() {
    if (this.shieldMesh) this.shieldMesh.visible = this.shield > 0;
  }

  get driftTier() {
    if (this.driftCharge > 1.9) return 3;
    if (this.driftCharge > 1.1) return 2;
    if (this.driftCharge > 0.55) return 1;
    return 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
