// KARTOPIA - procedural mesh builders (no external 3D assets needed)
import * as THREE from 'three';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.7, metalness: opts.metal ?? 0.05, ...opts });

// Build a cute rounded buddy (Mii-style) from primitives.
export function buildCharacter(charDef) {
  const g = new THREE.Group();

  // Body (rounded torso)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.32, 6, 12), mat(charDef.shirt));
  body.position.y = 0.55;
  g.add(body);

  // Collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 12), mat(charDef.cap));
  collar.position.y = 0.92;
  g.add(collar);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), mat(charDef.skin, { rough: 0.85 }));
  head.position.y = 1.3;
  g.add(head);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(charDef.skin, { rough: 0.85 }));
  nose.position.set(0, 1.26, 0.46);
  g.add(nose);

  // Cap dome + brim
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.49, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(charDef.cap)
  );
  cap.position.y = 1.36;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 14, 1, false, 0, Math.PI), mat(charDef.cap));
  brim.position.set(0, 1.34, 0.34);
  brim.scale.set(1, 1, 1.4);
  g.add(brim);

  // Eyes
  const eyeMat = mat(0x1a1a1a, { rough: 0.3 });
  const eyeWhiteMat = mat(0xffffff, { rough: 0.4 });
  for (const sx of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), eyeWhiteMat);
    white.position.set(0.16 * sx, 1.34, 0.4);
    white.scale.set(0.8, 1.1, 0.6);
    g.add(white);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), eyeMat);
    eye.position.set(0.16 * sx, 1.34, 0.46);
    g.add(eye);
  }

  // Smile (thin dark torus arc)
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), mat(0x7a3b2b, { rough: 0.6 }));
  smile.position.set(0, 1.18, 0.43);
  smile.rotation.x = Math.PI;
  g.add(smile);

  // Little arms reaching toward the wheel
  const armMat = mat(charDef.skin, { rough: 0.85 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.34, 4, 8), armMat);
    arm.position.set(0.34 * sx, 0.62, 0.28);
    arm.rotation.x = -0.9;
    arm.rotation.z = 0.3 * sx;
    g.add(arm);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}

// Build a chunky little kart. Returns { group, wheels, frontWheels, flame }.
export function buildKart(kartDef) {
  const group = new THREE.Group();
  const bodyMat = mat(kartDef.color, { metal: 0.3, rough: 0.4 });
  const accentMat = mat(kartDef.accent, { rough: 0.6 });

  // Chassis (layered boxes for a softer look)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.2), bodyMat);
  chassis.position.y = 0.48;
  group.add(chassis);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.9), accentMat);
  belly.position.y = 0.3;
  group.add(belly);

  // Rounded nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), bodyMat);
  nose.scale.set(1.05, 0.55, 1.1);
  nose.position.set(0, 0.5, 1.0);
  group.add(nose);

  // Side pods
  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 1.5), bodyMat);
    pod.position.set(0.78 * sx, 0.45, 0.05);
    group.add(pod);
  }

  // Headlights
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0b0, emissiveIntensity: 0.7, roughness: 0.3 });
  for (const sx of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lightMat);
    light.position.set(0.28 * sx, 0.56, 1.42);
    group.add(light);
  }

  // Seat + steering wheel
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.7), accentMat);
  seat.position.set(0, 0.78, -0.45);
  group.add(seat);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), mat(0x222222, { rough: 0.5 }));
  wheel.position.set(0, 0.85, 0.25);
  wheel.rotation.x = 1.1;
  group.add(wheel);

  // Spoiler
  const spoilerBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.35), accentMat);
  spoilerBar.position.set(0, 1.02, -1.05);
  group.add(spoilerBar);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), accentMat);
    post.position.set(0.45 * sx, 0.8, -1.05);
    group.add(post);
  }

  // Exhaust pipes
  const pipeMat = mat(0xbfc4cc, { metal: 0.8, rough: 0.3 });
  for (const sx of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 8), pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0.3 * sx, 0.62, -1.25);
    group.add(pipe);
  }

  // Wheels (black tire + colored rim)
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16);
  const tireMat = mat(0x1c1c1c, { rough: 0.9 });
  const rimMat = mat(kartDef.accent, { metal: 0.6, rough: 0.3 });
  const wheels = [];
  const frontWheels = [];
  const wheelPos = [
    [-0.84, 0.42, 0.78, true],
    [0.84, 0.42, 0.78, true],
    [-0.84, 0.42, -0.78, false],
    [0.84, 0.42, -0.78, false],
  ];
  for (const [x, y, z, isFront] of wheelPos) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    w.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8), rimMat);
    rim.rotation.z = Math.PI / 2;
    w.add(rim);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
    if (isFront) frontWheels.push(w);
  }

  // Boost flame (hidden until boosting)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 1.2, 10),
    new THREE.MeshBasicMaterial({ color: 0x4dc3ff, transparent: true, opacity: 0.9 })
  );
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0.5, -1.5);
  flame.visible = false;
  group.add(flame);

  // Soft blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, wheels, frontWheels, flame };
}
