import * as THREE from 'three';

/**
 * Builds the iconic twin-outboard center-console speedboat matching the reference screenshot:
 * - White fiberglass V-hull facing -Z (forward)
 * - Recessed interior cockpit, bow deck, gunwales & dark rub-rail
 * - Rear transom box with oval glass livewell window
 * - Twin pivoting black V6 outboard motors with red decals & spinning props
 * - Leaning-post seat, center console with tinted windshield & helm
 * - Stylized driver (white long-sleeve shirt) & passenger
 * - 3D prop-wash froth & bow/chine spray particle system
 */
export function createSpeedboat(scene) {
  const root = new THREE.Group();
  const hullGroup = new THREE.Group();
  root.add(hullGroup);

  // Materials
  const hullWhite = new THREE.MeshStandardMaterial({
    color: 0xeff3f5,
    roughness: 0.24,
    metalness: 0.08,
    side: THREE.DoubleSide
  });
  const deckGrey = new THREE.MeshStandardMaterial({
    color: 0xc9d2d8,
    roughness: 0.62,
    metalness: 0.04
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x262c32,
    roughness: 0.55,
    metalness: 0.15
  });
  const motorBlack = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    roughness: 0.22,
    metalness: 0.35
  });
  const motorAccent = new THREE.MeshStandardMaterial({
    color: 0xb81d2c,
    roughness: 0.3,
    metalness: 0.25
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdce4ea,
    roughness: 0.15,
    metalness: 0.88
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    roughness: 0.78,
    metalness: 0.02
  });
  const lightCushionMat = new THREE.MeshStandardMaterial({
    color: 0xd9dee2,
    roughness: 0.72
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3c4c,
    roughness: 0.08,
    metalness: 0.1,
    transmission: 0.45,
    transparent: true,
    opacity: 0.72
  });

  // --- Sculpted V-Hull Outer Shell ---
  const hullGeo = buildVHullGeometry();
  const hullMesh = new THREE.Mesh(hullGeo, hullWhite);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  hullGroup.add(hullMesh);

  // Hull lower stripe / waterline accent
  const stripeGeo = new THREE.BoxGeometry(2.74, 0.12, 5.2);
  const stripeMesh = new THREE.Mesh(stripeGeo, darkTrim);
  stripeMesh.position.set(0, 0.22, 0.7);
  hullGroup.add(stripeMesh);

  // Interior floor deck
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 5.6), deckGrey);
  floorMesh.position.set(0, 0.34, 0.25);
  floorMesh.receiveShadow = true;
  hullGroup.add(floorMesh);

  // Gunwale side walls (port & starboard)
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 5.65), hullWhite);
    wall.position.set(side * 1.18, 0.68, 0.38);
    wall.castShadow = true;
    wall.receiveShadow = true;
    hullGroup.add(wall);

    // Top gunwale cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 5.75), hullWhite);
    cap.position.set(side * 1.19, 1.01, 0.38);
    hullGroup.add(cap);

    // Rub rail trim
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 5.8), darkTrim);
    rail.position.set(side * 1.36, 0.96, 0.38);
    hullGroup.add(rail);

    // Tapered bow gunwale rails converging to bow tip
    const bowRail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.56, 2.55), hullWhite);
    bowRail.position.set(side * 0.64, 0.74, -3.28);
    bowRail.rotation.y = side * 0.44;
    bowRail.castShadow = true;
    hullGroup.add(bowRail);

    // Stainless bow grab rail
    const grab = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.9, 8), chromeMat);
    grab.rotation.x = Math.PI * 0.5;
    grab.rotation.z = side * 0.42;
    grab.position.set(side * 0.72, 1.14, -3.05);
    hullGroup.add(grab);

    // Rear swim platform step
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.72), hullWhite);
    step.position.set(side * 1.0, 0.32, 3.68);
    hullGroup.add(step);
  }

  // Forward bow casting deck (tapered wedge pointing forward along -Z)
  const bowDeckShape = new THREE.Shape();
  bowDeckShape.moveTo(-1.12, 0);
  bowDeckShape.lineTo(1.12, 0);
  bowDeckShape.lineTo(0.14, 2.26);
  bowDeckShape.lineTo(-0.14, 2.26);
  bowDeckShape.closePath();
  const bowDeckGeo = new THREE.ExtrudeGeometry(bowDeckShape, { depth: 0.20, bevelEnabled: false });
  bowDeckGeo.rotateX(-Math.PI * 0.5);
  const bowDeck = new THREE.Mesh(bowDeckGeo, hullWhite);
  bowDeck.position.set(0, 0.72, -2.18);
  bowDeck.receiveShadow = true;
  hullGroup.add(bowDeck);

  // Bow cushion
  const bowCushion = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.15), lightCushionMat);
  bowCushion.position.set(0, 0.94, -2.78);
  hullGroup.add(bowCushion);

  // --- Rear Transom Box with Iconic Oval Livewell Hatch (matching screenshot!) ---
  const transomBox = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.82, 0.96), hullWhite);
  transomBox.position.set(0, 0.66, 2.95);
  transomBox.castShadow = true;
  transomBox.receiveShadow = true;
  hullGroup.add(transomBox);

  // Oval livewell window on top of transom box
  const livewellFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 24), darkTrim);
  livewellFrame.scale.set(1.6, 1, 0.72);
  livewellFrame.position.set(0, 1.07, 2.88);
  hullGroup.add(livewellFrame);

  const livewellGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.06, 24), glassMat);
  livewellGlass.scale.set(1.55, 1, 0.68);
  livewellGlass.position.set(0, 1.08, 2.88);
  hullGroup.add(livewellGlass);

  // --- Leaning-Post Helm Seat ---
  const seatGroup = new THREE.Group();
  seatGroup.position.set(0, 0.36, 0.92);
  hullGroup.add(seatGroup);

  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.68, 0.62), hullWhite);
  seatBase.position.y = 0.34;
  seatBase.castShadow = true;
  seatGroup.add(seatBase);

  const seatPad = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.15, 0.66), cushionMat);
  seatPad.position.y = 0.74;
  seatGroup.add(seatPad);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.34, 0.14), cushionMat);
  backrest.position.set(0, 1.08, 0.25);
  backrest.castShadow = true;
  seatGroup.add(backrest);

  // Chrome backrest uprights & rocket-launcher rod holders
  for (const sx of [-0.52, 0.52]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.52, 8), chromeMat);
    post.position.set(sx, 0.92, 0.26);
    seatGroup.add(post);
  }
  for (const rx of [-0.36, -0.12, 0.12, 0.36]) {
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 8), chromeMat);
    holder.position.set(rx, 1.04, 0.36);
    holder.rotation.x = 0.22;
    seatGroup.add(holder);
  }

  // --- Center Console & Helm ---
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0, 0.36, -0.58);
  hullGroup.add(consoleGroup);

  const consoleBody = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.06, 1.12), hullWhite);
  consoleBody.position.y = 0.53;
  consoleBody.castShadow = true;
  consoleGroup.add(consoleBody);

  // Angled dashboard top
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 0.72), darkTrim);
  dash.position.set(0, 1.06, 0.18);
  dash.rotation.x = 0.36;
  consoleGroup.add(dash);

  // Glowing marine GPS display
  const gpsScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x26d9d0 })
  );
  gpsScreen.position.set(0.18, 1.13, 0.44);
  gpsScreen.rotation.x = -1.2;
  consoleGroup.add(gpsScreen);

  // Tinted windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.48, 0.05), glassMat);
  windshield.position.set(0, 1.32, -0.16);
  windshield.rotation.x = -0.34;
  consoleGroup.add(windshield);

  // Windshield grab hoop
  for (const sx of [-0.56, 0.56]) {
    const railSide = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 8), chromeMat);
    railSide.position.set(sx, 1.32, -0.16);
    railSide.rotation.x = -0.34;
    consoleGroup.add(railSide);
  }
  const railTop = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.14, 8), chromeMat);
  railTop.rotation.z = Math.PI * 0.5;
  railTop.position.set(0, 1.56, -0.25);
  consoleGroup.add(railTop);

  // Steering wheel
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(-0.22, 1.02, 0.62);
  wheelPivot.rotation.x = 0.42;
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 10, 20), chromeMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), darkTrim);
  wheelHub.rotation.x = Math.PI * 0.5;
  wheelPivot.add(wheelRim, wheelHub);
  consoleGroup.add(wheelPivot);

  // --- Stylized Driver & Passenger (matching screenshot!) ---
  const driver = createPerson({
    shirtColor: 0xdce1e4,
    hairColor: 0x3a2c22,
    skinColor: 0xc9936b,
    hasBackLogo: true
  });
  driver.position.set(-0.14, 0.36, 0.38);
  hullGroup.add(driver);

  const passenger = createPerson({
    shirtColor: 0x3b6e7d,
    hairColor: 0x261d17,
    skinColor: 0xc28a62,
    hasBackLogo: false
  });
  passenger.position.set(-0.28, 0.34, -0.52);
  passenger.scale.set(0.95, 0.94, 0.95);
  hullGroup.add(passenger);

  // --- Twin Pivoting Black V6 Outboard Motors ---
  const motors = [];
  const propellers = [];

  for (const sx of [-0.56, 0.56]) {
    const motorPivot = new THREE.Group();
    motorPivot.position.set(sx, 0.62, 3.68);
    hullGroup.add(motorPivot);

    // Mounting transom bracket
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.36), darkTrim);
    bracket.position.set(0, 0.02, -0.18);
    motorPivot.add(bracket);

    // Sculpted upper cowling (tall V6 profile seen prominently in screenshot)
    const cowling = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.92, 0.78), motorBlack);
    cowling.position.set(0, 0.46, 0.14);
    cowling.castShadow = true;
    motorPivot.add(cowling);

    // Rounded cowling top dome
    const cowlTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.78, 14), motorBlack);
    cowlTop.rotation.x = Math.PI * 0.5;
    cowlTop.scale.set(1.0, 1.0, 0.45);
    cowlTop.position.set(0, 0.92, 0.14);
    motorPivot.add(cowlTop);

    // Subtle red brand stripe on rear face of cowling (matching screenshot's red logo!)
    const decalRear = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.02), motorAccent);
    decalRear.position.set(0, 0.56, 0.54);
    motorPivot.add(decalRear);

    const decalBadge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.02), chromeMat);
    decalBadge.position.set(0, 0.72, 0.54);
    motorPivot.add(decalBadge);

    // Side decals
    for (const side of [-1, 1]) {
      const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.54), motorAccent);
      sideStripe.position.set(side * 0.285, 0.58, 0.14);
      motorPivot.add(sideStripe);
    }

    // Mid-section leg & lower gearcase
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.76, 0.42), motorBlack);
    shaft.position.set(0, -0.34, 0.08);
    motorPivot.add(shaft);

    const gearcase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.62, 10), motorBlack);
    gearcase.rotation.x = Math.PI * 0.5;
    gearcase.position.set(0, -0.72, 0.14);
    motorPivot.add(gearcase);

    // 3-blade stainless propeller
    const propGroup = new THREE.Group();
    propGroup.position.set(0, -0.72, 0.48);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.02), chromeMat);
      const a = (b / 3) * Math.PI * 2;
      blade.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0);
      blade.rotation.z = a;
      blade.rotation.y = 0.42;
      propGroup.add(blade);
    }
    motorPivot.add(propGroup);

    motors.push(motorPivot);
    propellers.push(propGroup);
  }

  // Navigation lights (port red, starboard green)
  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2b3a })
  );
  portLight.position.set(-1.12, 1.07, -1.8);
  const stbdLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x1ee672 })
  );
  stbdLight.position.set(1.12, 1.07, -1.8);
  hullGroup.add(portLight, stbdLight);

  // Boost exhaust glow under transom (subtle cyan-pink energy burst when boosting)
  const boostGlow = new THREE.PointLight(0x3af0ff, 0, 12);
  boostGlow.position.set(0, 0.3, 4.4);
  hullGroup.add(boostGlow);

  scene.add(root);

  // --- 3D Water Spray & Frothy Prop-Wash Particle System ---
  const spray = createSpraySystem(scene);

  const sternLocal = new THREE.Vector3(0, 0, 4.15);
  const sternWorld = new THREE.Vector3();

  function getSternWorldPosition() {
    root.updateMatrixWorld();
    return sternWorld.copy(sternLocal).applyMatrix4(root.matrixWorld);
  }

  function updateVisuals(dt, { steerAngle, speed, throttle, boosting, splashBurst, waterY }) {
    // Pivot twin outboard motors and steering wheel
    const motorYaw = -steerAngle * 0.55;
    for (const m of motors) {
      m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, motorYaw, Math.min(1, dt * 12));
    }
    wheelPivot.rotation.z = THREE.MathUtils.lerp(wheelPivot.rotation.z, -steerAngle * 1.4, Math.min(1, dt * 10));

    // Spin propellers proportionally to throttle/speed
    const propSpin = (2.5 + Math.abs(speed) * 1.3 + Math.abs(throttle) * 14.0) * dt;
    for (const p of propellers) {
      p.rotation.z += propSpin;
    }

    // Subtle human lean into turns
    driver.rotation.z = THREE.MathUtils.lerp(driver.rotation.z, steerAngle * 0.16, Math.min(1, dt * 6));
    passenger.rotation.z = THREE.MathUtils.lerp(passenger.rotation.z, steerAngle * 0.12, Math.min(1, dt * 5));

    // Boost light
    boostGlow.intensity = THREE.MathUtils.lerp(boostGlow.intensity, boosting ? 3.5 : 0, Math.min(1, dt * 8));

    // Update spray particles
    spray.update(dt, root, speed, steerAngle, boosting, splashBurst, waterY);
  }

  return { root, hullGroup, getSternWorldPosition, updateVisuals };
}

function buildVHullGeometry() {
  // Custom lofted speedboat V-hull from stern (z = +3.55) to pointed bow (z = -4.55)
  const sections = [
    // [z, halfBeamTop, halfBeamChine, keelY, chineY, deckY]
    { z: 3.55, top: 1.34, chine: 1.18, keelY: -0.26, chineY: 0.14, deckY: 0.96 },
    { z: 1.40, top: 1.36, chine: 1.20, keelY: -0.32, chineY: 0.12, deckY: 0.96 },
    { z: -0.90, top: 1.30, chine: 1.08, keelY: -0.34, chineY: 0.14, deckY: 0.98 },
    { z: -2.45, top: 1.04, chine: 0.72, keelY: -0.28, chineY: 0.22, deckY: 1.04 },
    { z: -3.65, top: 0.54, chine: 0.28, keelY: -0.10, chineY: 0.36, deckY: 1.12 },
    { z: -4.55, top: 0.05, chine: 0.03, keelY: 0.24, chineY: 0.56, deckY: 1.20 }
  ];

  // 5 profile vertices per cross-section: portTop, portChine, keel, stbdChine, stbdTop
  const positions = [];
  const indices = [];

  for (const s of sections) {
    positions.push(
      -s.top, s.deckY, s.z,
      -s.chine, s.chineY, s.z,
      0, s.keelY, s.z,
      s.chine, s.chineY, s.z,
      s.top, s.deckY, s.z
    );
  }

  const ringSize = 5;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = i * ringSize;
    const b = (i + 1) * ringSize;
    for (let j = 0; j < ringSize - 1; j++) {
      const v0 = a + j;
      const v1 = a + j + 1;
      const v2 = b + j;
      const v3 = b + j + 1;
      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }
  }

  // Close stern transom cap (section 0)
  indices.push(0, 1, 2, 0, 2, 3, 0, 3, 4);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createPerson({ shirtColor, hairColor, skinColor, hasBackLogo }) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a333b, roughness: 0.85 });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.68, 0.24), pantsMat);
  legs.position.y = 0.34;
  g.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.25), shirtMat);
  torso.position.y = 0.96;
  torso.castShadow = true;
  g.add(torso);

  if (hasBackLogo) {
    // Circular back graphic visible on the driver's white rashguard in screenshot
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.115, 20),
      new THREE.MeshBasicMaterial({ color: 0x62707a, side: THREE.DoubleSide })
    );
    ring.position.set(0, 0.99, 0.132);
    g.add(ring);
  }

  // Shoulders & arms reaching slightly forward
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.52, 8), shirtMat);
    arm.position.set(side * 0.26, 0.94, -0.14);
    arm.rotation.x = 0.72;
    arm.rotation.z = side * 0.18;
    g.add(arm);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 12), skinMat);
  head.position.set(0, 1.39, -0.02);
  head.castShadow = true;
  g.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hair.position.set(0, 1.41, 0.0);
  g.add(hair);

  return g;
}

function createSpraySystem(scene) {
  const MAX_PARTICLES = 260;
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const sizes = new Float32Array(MAX_PARTICLES);
  const alphas = new Float32Array(MAX_PARTICLES);

  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      active: false,
      age: 0,
      life: 1,
      x: 0, y: -50, z: 0,
      vx: 0, vy: 0, vz: 0,
      baseSize: 1.0
    });
    positions[i * 3 + 1] = -50;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (260.0 / max(-mvPosition.z, 1.0));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(0.94, 0.99, 1.0, soft * vAlpha);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  const tmpPos = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  function spawn(x, y, z, vx, vy, vz, life, baseSize) {
    const p = particles[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.age = 0;
    p.life = life;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.baseSize = baseSize;
  }

  function update(dt, boatRoot, speed, steerAngle, boosting, splashBurst, waterY) {
    boatRoot.updateMatrixWorld();
    forward.set(0, 0, -1).applyQuaternion(boatRoot.quaternion).normalize();
    right.set(1, 0, 0).applyQuaternion(boatRoot.quaternion).normalize();

    const absSpeed = Math.abs(speed);

    // 1. Frothy prop wash bubbling right behind the twin outboards
    if (absSpeed > 2.2) {
      const count = boosting ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const sideJitter = (Math.random() - 0.5) * 1.45;
        tmpPos.set(sideJitter, 0.08, 4.2 + Math.random() * 0.5).applyMatrix4(boatRoot.matrixWorld);
        const outSpread = sideJitter * 1.6;
        spawn(
          tmpPos.x,
          Math.max(tmpPos.y, waterY + 0.05),
          tmpPos.z,
          -forward.x * (absSpeed * 0.25 + 2.0) + right.x * outSpread + (Math.random() - 0.5) * 1.4,
          0.9 + Math.random() * (boosting ? 2.4 : 1.3),
          -forward.z * (absSpeed * 0.25 + 2.0) + right.z * outSpread + (Math.random() - 0.5) * 1.4,
          0.45 + Math.random() * 0.45,
          boosting ? 2.2 : 1.55
        );
      }
    }

    // 2. Side chine spray sheets fanning off both sides of the hull at planing speed
    if (absSpeed > 7.5) {
      for (const side of [-1, 1]) {
        const turnBoost = side * steerAngle < 0 ? 1.5 : 0.9;
        tmpPos.set(side * 1.25, 0.16, -0.5 + Math.random() * 2.4).applyMatrix4(boatRoot.matrixWorld);
        const lateral = (2.8 + absSpeed * 0.18) * turnBoost;
        spawn(
          tmpPos.x,
          Math.max(tmpPos.y, waterY + 0.08),
          tmpPos.z,
          right.x * side * lateral + forward.x * (absSpeed * 0.32),
          1.2 + Math.random() * 1.6,
          right.z * side * lateral + forward.z * (absSpeed * 0.32),
          0.38 + Math.random() * 0.32,
          1.25 + Math.random() * 0.7
        );
      }
    }

    // 3. Wave-jump landing splash burst!
    if (splashBurst > 0.2) {
      const burstCount = Math.min(28, Math.floor(splashBurst * 18));
      for (let i = 0; i < burstCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        tmpPos.set(side * (0.9 + Math.random() * 0.5), 0.15, -2.2 + Math.random() * 4.5).applyMatrix4(boatRoot.matrixWorld);
        spawn(
          tmpPos.x,
          waterY + 0.15,
          tmpPos.z,
          right.x * side * (4.5 + Math.random() * 5.5) + (Math.random() - 0.5) * 2.5,
          2.6 + Math.random() * 3.8 * splashBurst,
          right.z * side * (4.5 + Math.random() * 5.5) + (Math.random() - 0.5) * 2.5,
          0.55 + Math.random() * 0.45,
          1.9 + Math.random() * 1.2
        );
      }
    }

    // Integrate particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) {
        alphas[i] = 0;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        alphas[i] = 0;
        positions[i * 3 + 1] = -50;
        continue;
      }
      p.vy -= 9.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 1 - Math.min(1, dt * 1.6);
      p.vz *= 1 - Math.min(1, dt * 1.6);

      const t = p.age / p.life;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = Math.max(p.y, waterY - 0.25);
      positions[i * 3 + 2] = p.z;
      sizes[i] = p.baseSize * (0.65 + t * 1.85);
      alphas[i] = Math.sin(t * Math.PI) * 0.62;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  return { points, update };
}
