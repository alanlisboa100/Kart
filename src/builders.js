// KARTOPIA - procedural mesh builders (no external 3D assets needed)
import * as THREE from 'three';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.7, metalness: opts.metal ?? 0.05, ...opts });

// Build a cute rounded buddy (Mii-style) from primitives.
export function buildCharacter(charDef) {
  const g = new THREE.Group();
  const hairColor = charDef.cap; // reuse cap color as hair/helmet accent

  // Torso (slightly tapered, friendly)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.36, 8, 16), mat(charDef.shirt));
  body.position.y = 0.55;
  g.add(body);

  // Racing collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.14, 16), mat(charDef.cap));
  collar.position.y = 0.92;
  g.add(collar);

  // Head (a touch bigger for that cute chibi look)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 20), mat(charDef.skin, { rough: 0.8 }));
  head.position.y = 1.36;
  g.add(head);

  // Ears
  const earMat = mat(charDef.skin, { rough: 0.8 });
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), earMat);
    ear.position.set(0.48 * sx, 1.36, 0.02);
    ear.scale.set(0.6, 1, 0.7);
    g.add(ear);
  }

  // Helmet (smooth dome) + visor band
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mat(hairColor, { metal: 0.2, rough: 0.45 })
  );
  helmet.position.y = 1.42;
  g.add(helmet);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 10, 28), mat(0xffffff, { rough: 0.4 }));
  band.position.y = 1.46;
  band.rotation.x = Math.PI / 2;
  g.add(band);

  // Optional ponytail (visual variety) for characters flagged hair:'pony'.
  if (charDef.hair === 'pony') {
    const hairCol = charDef.hairColor != null ? charDef.hairColor : 0x4a2c12;
    const tieMat = mat(hairCol, { rough: 0.6 });
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), tieMat);
    tie.position.set(0, 1.5, -0.5);
    g.add(tie);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 6, 10), tieMat);
    tail.position.set(0, 1.15, -0.6);
    tail.rotation.x = 0.35;
    g.add(tail);
  } else if (charDef.hair === 'bun') {
    const hairCol = charDef.hairColor != null ? charDef.hairColor : 0x2a1a0c;
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(hairCol, { rough: 0.6 }));
    bun.position.set(0, 1.82, -0.05);
    g.add(bun);
  }

  // Big friendly eyes (white + iris + shine)
  const eyeWhiteMat = mat(0xffffff, { rough: 0.25 });
  const irisMat = mat(0x2a2a3a, { rough: 0.2 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), eyeWhiteMat);
    white.position.set(0.18 * sx, 1.4, 0.42);
    white.scale.set(0.85, 1.15, 0.6);
    g.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), irisMat);
    iris.position.set(0.18 * sx, 1.39, 0.5);
    g.add(iris);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), shineMat);
    shine.position.set(0.2 * sx, 1.43, 0.55);
    g.add(shine);
  }

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), earMat);
  nose.position.set(0, 1.32, 0.52);
  g.add(nose);

  // Rosy cheeks
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff8aa0, roughness: 0.7, transparent: true, opacity: 0.6 });
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), cheekMat);
    cheek.position.set(0.28 * sx, 1.26, 0.42);
    cheek.scale.set(1, 0.7, 0.4);
    g.add(cheek);
  }

  // Smile
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 8, 16, Math.PI), mat(0x6a2e22, { rough: 0.6 }));
  smile.position.set(0, 1.22, 0.46);
  smile.rotation.x = Math.PI;
  g.add(smile);

  // Arms reaching to the wheel, with glove hands
  const armMat = mat(charDef.shirt, { rough: 0.7 });
  const gloveMat = mat(0xffffff, { rough: 0.5 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.38, 6, 10), armMat);
    arm.position.set(0.34 * sx, 0.64, 0.3);
    arm.rotation.x = -0.95;
    arm.rotation.z = 0.32 * sx;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), gloveMat);
    hand.position.set(0.26 * sx, 0.5, 0.62);
    g.add(hand);
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

  // Side pods (sculpted: tapered toward the back for a sportier look)
  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 1.6), bodyMat);
    pod.position.set(0.78 * sx, 0.46, 0.05);
    group.add(pod);
    // pod intake (dark vent at the front of each pod)
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.18), mat(0x111418, { rough: 0.5 }));
    intake.position.set(0.78 * sx, 0.5, 0.9);
    group.add(intake);
  }

  // Hood scoop on the nose
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), accentMat);
  scoop.position.set(0, 0.66, 0.7);
  group.add(scoop);

  // Rear diffuser (angled panel under the back)
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.5), mat(0x15171c, { rough: 0.6 }));
  diffuser.position.set(0, 0.34, -1.12);
  diffuser.rotation.x = 0.35;
  group.add(diffuser);

  // Underglow strip (subtle neon accent under the chassis)
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.05, 2.0),
    new THREE.MeshBasicMaterial({ color: kartDef.accent, transparent: true, opacity: 0.5 })
  );
  glow.position.y = 0.14;
  group.add(glow);

  // Headlights (lens housing + bright lens)
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0b0, emissiveIntensity: 0.9, roughness: 0.2 });
  const lightHousingMat = mat(0x222831, { metal: 0.5, rough: 0.3 });
  for (const sx of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), lightHousingMat);
    housing.position.set(0.34 * sx, 0.6, 1.43);
    group.add(housing);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lightMat);
    light.scale.set(1.2, 0.8, 0.6);
    light.position.set(0.34 * sx, 0.6, 1.5);
    group.add(light);
  }

  // Roll bar behind the driver (sporty silhouette)
  const rollBar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 16, Math.PI), mat(0xced3da, { metal: 0.7, rough: 0.3 }));
  rollBar.position.set(0, 1.0, -0.5);
  group.add(rollBar);

  // Tail lights (red, glowing) at the back
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 0.8, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.08), tailMat);
    tail.position.set(0.4 * sx, 0.6, -1.18);
    group.add(tail);
  }

  // Windshield (tinted, semi-transparent) in front of the seat
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.4, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.3 })
  );
  windshield.position.set(0, 0.95, 0.05);
  windshield.rotation.x = -0.5;
  group.add(windshield);

  // Number roundel on the nose
  const roundel = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  );
  roundel.position.set(0, 0.62, 1.51);
  group.add(roundel);

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

  // Drift sparks (two little glowing dots near the rear wheels)
  const sparks = [];
  for (const sx of [-1, 1]) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x4dc3ff, transparent: true, opacity: 0.9 })
    );
    spark.position.set(0.84 * sx, 0.3, -0.78);
    spark.visible = false;
    group.add(spark);
    sparks.push(spark);
  }

  // Soft blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, wheels, frontWheels, flame, sparks };
}
