// KARTOPIA - waypoint AI that brakes for corners and drifts through sharp ones.
import * as THREE from 'three';
const clamp = THREE.MathUtils.clamp;

export class AIController {
  constructor(skill = 0.9) {
    this.skill = clamp(skill, 0.5, 1);
    this.aimAhead = 14 + Math.floor(this.skill * 8);   // samples to steer toward
    this.brakeAhead = 34 + Math.floor(this.skill * 16); // samples to look for bends
  }

  control(kart, track) {
    const N = track.N;
    const i = kart.segIndex;

    // --- Steering toward an aim point on the centerline ---
    const aim = track.samples[(i + this.aimAhead) % N];
    const desired = Math.atan2(aim.x - kart.pos.x, aim.z - kart.pos.z);
    const diff = wrapAngle(desired - kart.heading);
    const steer = clamp(diff * 2.6, -1, 1);

    // --- Look ahead for the upcoming bend (total heading change) ---
    const tNear = track.tangents[i];
    const tFar = track.tangents[(i + this.brakeAhead) % N];
    const bend = Math.abs(wrapAngle(
      Math.atan2(tFar.x, tFar.z) - Math.atan2(tNear.x, tNear.z)
    ));

    // --- Choose a target speed: slower for sharper bends ---
    const cornerFactor = clamp(1 - bend * 0.55, 0.42, 1);
    const targetSpeed = kart.maxSpeed * cornerFactor * (0.86 + 0.14 * this.skill);

    let throttle = 0, brake = 0;
    if (kart.speed < targetSpeed - 0.5) throttle = 1;
    else if (kart.speed > targetSpeed + 2) brake = clamp((kart.speed - targetSpeed) / 8, 0, 1);
    else throttle = 0.6;

    // --- Drift through genuinely sharp turns when fast ---
    const drift = bend > 0.45 && Math.abs(diff) > 0.22 && kart.speed > kart.maxSpeed * 0.5;

    return { throttle, brake, steer, drift };
  }
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
