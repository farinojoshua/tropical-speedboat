import * as THREE from 'three';

/**
 * High-detail, smoothly sculpted twin-outboard center-console speedboat:
 * - 36-station curved parametric fiberglass V-hull & continuous swept gunwale rub-rail
 * - Rounded beveled fiberglass console, leaning-post bolster cushions & transom livewell
 * - Aerodynamic lofted metallic-black V6 outboard cowlings with clearcoat & decals
 * - Organic capsule-sculpted driver (white rashguard with circular back graphic) & passenger
 * - Soft billowy canvas-textured water spray & prop-wash particle system
 */
export function createSpeedboat(scene) {
  const root = new THREE.Group();
  const hullGroup = new THREE.Group();
  root.add(hullGroup);

  // Glossy marine fiberglass & clearcoat materials (reflect sky/ocean envMap!)
  const hullWhite = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f7,
    roughness: 0.16,
    metalness: 0.04,
    clearcoat: 0.92,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide
  });

  const deckTexture = createNonSlipDeckTexture();
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0e5,
    map: deckTexture,
    roughness: 0.65,
    metalness: 0.02
  });

  const darkTrim = new THREE.MeshPhysicalMaterial({
    color: 0x20262c,
    roughness: 0.42,
    metalness: 0.12,
    clearcoat: 0.35
  });

  const motorClearcoat = new THREE.MeshPhysicalMaterial({
    color: 0x161a20,
    roughness: 0.14,
    metalness: 0.38,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08
  });

  const motorLowerMat = new THREE.MeshStandardMaterial({
    color: 0x242a32,
    roughness: 0.32,
    metalness: 0.55
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf2,
    roughness: 0.1,
    metalness: 0.94
  });

  const cushionDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3b4148,
    roughness: 0.72,
    metalness: 0.02
  });

  const cushionLightMat = new THREE.MeshStandardMaterial({
    color: 0xe4e8ec,
    roughness: 0.68,
    metalness: 0.02
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x19384a,
    roughness: 0.06,
    metalness: 0.08,
    transmission: 0.48,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.76
  });

  // --- 1. Parametric Smooth Curved V-Hull + Flared Bow + Recessed Interior ---
  const { hullGeo, sheerCurvePoints } = buildSmoothVHull();
  const hullMesh = new THREE.Mesh(hullGeo, hullWhite);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  hullGroup.add(hullMesh);

  // Continuous swept curved gunwale cap & dark rub-rail around entire hull perimeter!
  const sheerCurve = new THREE.CatmullRomCurve3(sheerCurvePoints, false, 'catmullrom', 0.4);
  const gunwaleCapGeo = new THREE.TubeGeometry(sheerCurve, 72, 0.105, 14, false);
  const gunwaleCap = new THREE.Mesh(gunwaleCapGeo, hullWhite);
  gunwaleCap.castShadow = true;
  gunwaleCap.receiveShadow = true;
  hullGroup.add(gunwaleCap);

  // Dark outer rub-rail bumper following exact hull sheer curve
  const rubPoints = sheerCurvePoints.map((p) => new THREE.Vector3(p.x * 1.035, p.y - 0.03, p.z));
  const rubCurve = new THREE.CatmullRomCurve3(rubPoints, false, 'catmullrom', 0.4);
  const rubRail = new THREE.Mesh(new THREE.TubeGeometry(rubCurve, 72, 0.052, 10, false), darkTrim);
  hullGroup.add(rubRail);

  // Smooth curved cockpit floor following hull interior contour
  const floorShape = buildDeckContourShape(0.84, 3.05, -3.55);
  const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.08, bevelEnabled: false, curveSegments: 24 });
  floorGeo.rotateX(Math.PI * 0.5);
  const floorMesh = new THREE.Mesh(floorGeo, deckMat);
  floorMesh.position.set(0, 0.40, 0);
  floorMesh.receiveShadow = true;
  hullGroup.add(floorMesh);

  // Smooth raised curved bow casting deck + plush rounded sunpad cushion
  const bowDeckShape = buildDeckContourShape(0.86, -1.72, -4.32);
  const bowDeckGeo = new THREE.ExtrudeGeometry(bowDeckShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 4,
    curveSegments: 24
  });
  bowDeckGeo.rotateX(Math.PI * 0.5);
  const bowDeck = new THREE.Mesh(bowDeckGeo, hullWhite);
  bowDeck.position.set(0, 0.90, 0);
  bowDeck.receiveShadow = true;
  hullGroup.add(bowDeck);

  const bowCushionShape = buildDeckContourShape(0.68, -1.92, -3.88);
  const bowCushionGeo = new THREE.ExtrudeGeometry(bowCushionShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 4,
    curveSegments: 20
  });
  bowCushionGeo.rotateX(Math.PI * 0.5);
  const bowCushion = new THREE.Mesh(bowCushionGeo, cushionLightMat);
  bowCushion.position.set(0, 0.98, 0);
  hullGroup.add(bowCushion);

  // Curved stainless bow rails (port & starboard)
  for (const side of [-1, 1]) {
    const railPts = [
      new THREE.Vector3(side * 1.08, 1.03, -1.65),
      new THREE.Vector3(side * 0.92, 1.15, -2.45),
      new THREE.Vector3(side * 0.58, 1.21, -3.42),
      new THREE.Vector3(side * 0.22, 1.16, -4.18)
    ];
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 24, 0.022, 10, false), chromeMat);
    hullGroup.add(railMesh);

    // Curved rear swim step platform
    const stepGeo = createRoundedBoxGeo(0.66, 0.14, 0.72, 0.14, 4);
    const step = new THREE.Mesh(stepGeo, hullWhite);
    step.position.set(side * 0.98, 0.34, 3.68);
    hullGroup.add(step);
  }

  // --- 2. Smooth Rounded Rear Transom Bench & Oval Glass Livewell Hatch ---
  const transomBox = new THREE.Mesh(createRoundedBoxGeo(2.38, 0.74, 0.92, 0.16, 5), hullWhite);
  transomBox.position.set(0, 0.71, 2.94);
  transomBox.castShadow = true;
  transomBox.receiveShadow = true;
  hullGroup.add(transomBox);

  // Molded fiberglass hatch rim + oval tinted livewell glass window (iconic screenshot detail!)
  const livewellRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 12, 32), hullWhite);
  livewellRim.rotation.x = Math.PI * 0.5;
  livewellRim.scale.set(1.55, 0.72, 1.0);
  livewellRim.position.set(0, 1.09, 2.90);
  hullGroup.add(livewellRim);

  const livewellBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 32), darkTrim);
  livewellBezel.scale.set(1.52, 1, 0.70);
  livewellBezel.position.set(0, 1.08, 2.90);
  hullGroup.add(livewellBezel);

  const livewellGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.05, 32), glassMat);
  livewellGlass.scale.set(1.48, 1, 0.66);
  livewellGlass.position.set(0, 1.09, 2.90);
  hullGroup.add(livewellGlass);

  // Subtle turquoise water glow inside livewell tank
  const livewellWell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.02, 24),
    new THREE.MeshBasicMaterial({ color: 0x35c9cf })
  );
  livewellWell.scale.set(1.42, 1, 0.62);
  livewellWell.position.set(0, 1.055, 2.90);
  hullGroup.add(livewellWell);

  // --- 3. Sculpted Leaning-Post Helm Seat with Rounded Bolsters ---
  const seatGroup = new THREE.Group();
  seatGroup.position.set(0, 0.38, 0.94);
  hullGroup.add(seatGroup);

  const seatPedestal = new THREE.Mesh(createRoundedBoxGeo(1.12, 0.66, 0.58, 0.12, 4), hullWhite);
  seatPedestal.position.y = 0.33;
  seatPedestal.castShadow = true;
  seatGroup.add(seatPedestal);

  const seatCushion = new THREE.Mesh(createRoundedBoxGeo(1.22, 0.16, 0.64, 0.08, 5), cushionDarkMat);
  seatCushion.position.y = 0.72;
  seatGroup.add(seatCushion);

  // Curved stitched bolster backrest
  const backrest = new THREE.Mesh(createRoundedBoxGeo(1.22, 0.32, 0.14, 0.07, 5), cushionDarkMat);
  backrest.position.set(0, 1.06, 0.25);
  backrest.castShadow = true;
  seatGroup.add(backrest);

  // Smooth bent stainless seat frame & rod holders
  const framePts = [
    new THREE.Vector3(-0.54, 0.68, 0.26),
    new THREE.Vector3(-0.54, 1.08, 0.28),
    new THREE.Vector3(-0.46, 1.18, 0.28),
    new THREE.Vector3(0.46, 1.18, 0.28),
    new THREE.Vector3(0.54, 1.08, 0.28),
    new THREE.Vector3(0.54, 0.68, 0.26)
  ];
  const seatFrame = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(framePts), 32, 0.025, 10, false),
    chromeMat
  );
  seatGroup.add(seatFrame);

  for (const rx of [-0.36, -0.12, 0.12, 0.36]) {
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 14), chromeMat);
    holder.position.set(rx, 1.02, 0.36);
    holder.rotation.x = 0.22;
    seatGroup.add(holder);
  }

  // --- 4. Contoured Center Console & Wrap-Around Curved Windshield ---
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0, 0.38, -0.56);
  hullGroup.add(consoleGroup);

  const consoleBody = new THREE.Mesh(createRoundedBoxGeo(1.12, 1.04, 1.08, 0.16, 5), hullWhite);
  consoleBody.position.y = 0.52;
  consoleBody.castShadow = true;
  consoleGroup.add(consoleBody);

  const dashPod = new THREE.Mesh(createRoundedBoxGeo(1.06, 0.18, 0.66, 0.08, 4), darkTrim);
  dashPod.position.set(0, 1.06, 0.18);
  dashPod.rotation.x = 0.35;
  consoleGroup.add(dashPod);

  // Glowing marine GPS chartplotter screen
  const gpsScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x2de8de })
  );
  gpsScreen.position.set(0.18, 1.13, 0.45);
  gpsScreen.rotation.x = -1.22;
  consoleGroup.add(gpsScreen);

  // Smooth curved wrap-around tinted acrylic windshield
  const wsGeo = new THREE.CylinderGeometry(0.56, 0.62, 0.46, 28, 1, true, Math.PI * 0.68, Math.PI * 0.64);
  const windshield = new THREE.Mesh(wsGeo, glassMat);
  windshield.position.set(0, 1.28, 0.22);
  windshield.rotation.x = -0.18;
  consoleGroup.add(windshield);

  // Smooth curved stainless windshield grab hoop
  const hoopPts = [
    new THREE.Vector3(-0.56, 1.04, -0.02),
    new THREE.Vector3(-0.54, 1.48, -0.22),
    new THREE.Vector3(-0.36, 1.58, -0.32),
    new THREE.Vector3(0.36, 1.58, -0.32),
    new THREE.Vector3(0.54, 1.48, -0.22),
    new THREE.Vector3(0.56, 1.04, -0.02)
  ];
  const hoopMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hoopPts), 32, 0.022, 10, false),
    chromeMat
  );
  consoleGroup.add(hoopMesh);

  // Polished stainless marine steering wheel with spokes
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(-0.22, 1.02, 0.62);
  wheelPivot.rotation.x = 0.42;
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 14, 32), chromeMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 16), darkTrim);
  wheelHub.rotation.x = Math.PI * 0.5;
  wheelPivot.add(wheelRim, wheelHub);
  for (let s = 0; s < 3; s++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), chromeMat);
    const a = (s / 3) * Math.PI * 2;
    spoke.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
    spoke.rotation.z = a + Math.PI * 0.5;
    wheelPivot.add(spoke);
  }
  consoleGroup.add(wheelPivot);

  // Dual chrome marine throttle binnacle levers (physically tilt forward with throttle!)
  const throttlePivot = new THREE.Group();
  throttlePivot.position.set(0.36, 1.06, 0.36);
  for (const lx of [-0.032, 0.032]) {
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.22, 10), chromeMat);
    lever.position.set(lx, 0.10, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), darkTrim);
    knob.position.set(lx, 0.22, 0);
    throttlePivot.add(lever, knob);
  }
  consoleGroup.add(throttlePivot);

  // Interior padded white marine coaming bolsters & chrome mooring cleats along both gunwales
  for (const side of [-1, 1]) {
    const bolster = new THREE.Mesh(createRoundedBoxGeo(0.12, 0.22, 3.8, 0.05, 4), cushionLightMat);
    bolster.position.set(side * 1.12, 0.78, 0.72);
    hullGroup.add(bolster);

    for (const cz of [2.55, -0.35]) {
      const cleat = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.16, 6, 10), chromeMat);
      cleat.rotation.x = Math.PI * 0.5;
      cleat.position.set(side * 1.24, 1.05, cz);
      hullGroup.add(cleat);
    }
  }

  // --- 5. Organic Sculpted Driver & Passenger (Zero Boxes!) ---
  const driver = createOrganicPerson({
    shirtColor: '#dde3e7',
    hairColor: 0x35271e,
    skinColor: 0xc9936c,
    hasBackLogo: true
  });
  driver.position.set(-0.14, 0.40, 0.36);
  hullGroup.add(driver);

  const passenger = createOrganicPerson({
    shirtColor: '#366f80',
    hairColor: 0x241a14,
    skinColor: 0xc0875f,
    hasBackLogo: false
  });
  passenger.position.set(-0.26, 0.38, -0.54);
  passenger.scale.set(0.94, 0.93, 0.94);
  hullGroup.add(passenger);

  // --- 6. Sculpted Aerodynamic Twin V6 Outboard Motors ---
  const motors = [];
  const propellers = [];
  const decalTex = createOutboardDecalTexture();

  for (const sx of [-0.56, 0.56]) {
    const { pivot, propGroup } = createSculptedOutboard(motorClearcoat, motorLowerMat, darkTrim, chromeMat, decalTex);
    pivot.position.set(sx, 0.62, 3.64);
    hullGroup.add(pivot);
    motors.push(pivot);
    propellers.push(propGroup);
  }

  // Smooth dome navigation lights
  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xff2b3a })
  );
  portLight.position.set(-1.14, 1.07, -1.75);
  const stbdLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0x1ee672 })
  );
  stbdLight.position.set(1.14, 1.07, -1.75);
  hullGroup.add(portLight, stbdLight);

  // Subtle boost glow under transom
  const boostGlow = new THREE.PointLight(0x3af0ff, 0, 12);
  boostGlow.position.set(0, 0.3, 4.4);
  hullGroup.add(boostGlow);

  scene.add(root);

  // --- 7. Animated 3D Bow/Chine Water Sheets & Churning Twin-Prop Boil ---
  const waterSheets = createHullWaterSheets();
  hullGroup.add(waterSheets.group);

  // --- 8. Soft Billowy 3D Water Spray & Prop-Wash Foam ---
  const spray = createSpraySystem(scene);

  const sternLocal = new THREE.Vector3(0, 0, 4.18);
  const sternWorld = new THREE.Vector3();

  function getSternWorldPosition() {
    root.updateMatrixWorld();
    return sternWorld.copy(sternLocal).applyMatrix4(root.matrixWorld);
  }

  function updateVisuals(dt, { steerAngle, speed, throttle, boosting, splashBurst, waterY, time = 0, airborne = false }) {
    const motorYaw = -steerAngle * 0.55;
    for (const m of motors) {
      m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, motorYaw, Math.min(1, dt * 12));
    }
    wheelPivot.rotation.z = THREE.MathUtils.lerp(wheelPivot.rotation.z, -steerAngle * 1.4, Math.min(1, dt * 10));
    throttlePivot.rotation.x = THREE.MathUtils.lerp(
      throttlePivot.rotation.x,
      -throttle * 0.52 - (boosting ? 0.18 : 0),
      Math.min(1, dt * 9)
    );

    const propSpin = (2.5 + Math.abs(speed) * 1.3 + Math.abs(throttle) * 14.0) * dt;
    for (const p of propellers) {
      p.rotation.z += propSpin;
    }

    // Natural driver & passenger lean + gentle breathing/wave counter-balance
    const sway = Math.sin(time * 2.6) * 0.015;
    driver.rotation.z = THREE.MathUtils.lerp(driver.rotation.z, steerAngle * 0.18 + sway, Math.min(1, dt * 6));
    driver.rotation.x = THREE.MathUtils.lerp(driver.rotation.x, (boosting ? 0.08 : throttle * 0.04), Math.min(1, dt * 5));
    passenger.rotation.z = THREE.MathUtils.lerp(passenger.rotation.z, steerAngle * 0.14 - sway, Math.min(1, dt * 5));

    boostGlow.intensity = THREE.MathUtils.lerp(boostGlow.intensity, boosting ? 3.8 : 0, Math.min(1, dt * 8));
    waterSheets.update(time, dt, speed, steerAngle, boosting, airborne);
    spray.update(dt, root, speed, steerAngle, boosting, splashBurst, waterY);
  }

  return { root, hullGroup, getSternWorldPosition, updateVisuals };
}

/**
 * Animated 3D curving frothy water curtains hugging both sides of the hull
 * plus the churning white prop-wash boil right between the twin outboards (GTA VI look!).
 */
function createHullWaterSheets() {
  const group = new THREE.Group();

  const sheetShader = {
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      void main() {
        vUv = uv;
        vec3 p = position;
        float flutter = sin(uv.x * 16.0 - uTime * 14.0) * 0.08 * uv.y * uIntensity;
        p.y += flutter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      void main() {
        vec2 flowUv = vec2(vUv.x * 5.0 - uTime * 3.8, vUv.y * 3.2 - uTime * 1.4);
        float n = noise(flowUv) * 0.65 + noise(flowUv * 2.4 + 3.1) * 0.35;
        float edgeFade = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.74, 1.0, vUv.x));
        float crestFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
        float alpha = smoothstep(0.24, 0.72, n) * edgeFade * crestFade * uIntensity * 0.82;
        if (alpha < 0.01) discard;
        vec3 col = mix(vec3(0.68, 0.95, 0.98), vec3(1.0), smoothstep(0.32, 0.75, n));
        gl_FragColor = vec4(col, alpha);
      }
    `
  };

  const sideMat = new THREE.ShaderMaterial({
    ...sheetShader,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
    }
  });

  // Sculpted curling water curtain along port & starboard hull chines
  function makeCurledSheet(side) {
    const segX = 24;
    const segY = 8;
    const pos = [];
    const uvs = [];
    const idx = [];
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX; // 0 = bow entry, 1 = aft wake flare
      const z = THREE.MathUtils.lerp(-2.6, 5.4, u);
      const hullW = u < 0.45 ? THREE.MathUtils.lerp(0.88, 1.38, u / 0.45) : 1.38 + (u - 0.45) * 1.65;
      for (let iy = 0; iy <= segY; iy++) {
        const v = iy / segY; // 0 = hull waterline, 1 = outward curling foam crest
        const spread = v * (0.42 + u * 1.45);
        const curlY = Math.sin(v * Math.PI * 0.85) * (0.32 + u * 0.48) - v * v * 0.25;
        pos.push(side * (hullW + spread), 0.04 + curlY, z);
        uvs.push(u, v);
      }
    }
    for (let ix = 0; ix < segX; ix++) {
      for (let iy = 0; iy < segY; iy++) {
        const a = ix * (segY + 1) + iy;
        const b = a + (segY + 1);
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    return new THREE.Mesh(geo, sideMat);
  }

  const portSheet = makeCurledSheet(-1);
  const stbdSheet = makeCurledSheet(1);
  group.add(portSheet, stbdSheet);

  // Frothy churning twin-outboard prop-wash boil right behind transom (between the black motors!)
  const boilMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(uv.y * 14.0 - uTime * 18.0) * 0.09 * uIntensity * (1.0 - uv.y * 0.5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec2 uv = vec2(vUv.x * 3.5, vUv.y * 5.0 - uTime * 4.5);
        float n = noise(uv) * 0.6 + noise(uv * 2.4 - vec2(0.0, uTime * 2.2)) * 0.4;
        float sideFade = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
        float lenFade = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.52, 1.0, vUv.y));
        float alpha = smoothstep(0.20, 0.68, n) * sideFade * lenFade * uIntensity * 0.92;
        if (alpha < 0.01) discard;
        vec3 col = mix(vec3(0.72, 0.96, 0.99), vec3(1.0), smoothstep(0.28, 0.72, n));
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const boilGeo = new THREE.PlaneGeometry(2.15, 4.6, 12, 16);
  boilGeo.rotateX(-Math.PI * 0.5);
  const boilMesh = new THREE.Mesh(boilGeo, boilMat);
  boilMesh.position.set(0, 0.14, 5.75);
  group.add(boilMesh);

  let smoothIntensity = 0;

  function update(time, dt, speed, steerAngle, boosting, airborne) {
    const target = airborne ? 0 : THREE.MathUtils.clamp((Math.abs(speed) - 2.0) / 16.0, 0, 1.25) * (boosting ? 1.2 : 1.0);
    smoothIntensity = THREE.MathUtils.lerp(smoothIntensity, target, Math.min(1, dt * 6));
    sideMat.uniforms.uTime.value = time;
    sideMat.uniforms.uIntensity.value = smoothIntensity;
    boilMat.uniforms.uTime.value = time;
    boilMat.uniforms.uIntensity.value = smoothIntensity;

    // Outside sheet flares slightly taller during hard carve turns
    portSheet.scale.setScalar(1.0 + Math.max(0, -steerAngle) * 0.18);
    stbdSheet.scale.setScalar(1.0 + Math.max(0, steerAngle) * 0.18);
  }

  return { group, update };
}

/**
 * Parametric hull beam width at normalized longitudinal coordinate t (0 = stern +3.55, 1 = bow -4.65).
 */
function hullBeamAt(t) {
  if (t < 0.42) {
    // Full steady aft beam with subtle waist curve
    return 1.34 + Math.sin(t * Math.PI * 1.15) * 0.04;
  }
  const u = THREE.MathUtils.clamp((t - 0.42) / 0.58, 0, 1);
  // Graceful Carolina-flare bow curve (clamp cos >= 0 to avoid NaN on fractional pow)
  return Math.max(0.03, 1.35 * Math.pow(Math.max(0, Math.cos(u * Math.PI * 0.5)), 1.32));
}

function buildSmoothVHull() {
  const Z_STERN = 3.55;
  const Z_BOW = -4.65;
  const STATIONS = 34;
  // Smooth cross-section angles across the U/V hull profile (17 smooth points from port gunwale -> keel -> stbd gunwale)
  const PROFILE_STEPS = 16;

  const positions = [];
  const indices = [];
  const portSheer = [];
  const stbdSheer = [];

  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    const z = THREE.MathUtils.lerp(Z_STERN, Z_BOW, t);
    const halfBeam = hullBeamAt(t);
    const sheerY = 0.98 + Math.pow(t, 2.2) * 0.34; // Graceful upward bow sheer!
    const keelY = -0.28 + Math.pow(t, 2.6) * 0.72; // Curved forefoot rising to bow tip!
    const chineHeight = THREE.MathUtils.lerp(0.14, 0.66, Math.pow(t, 2.1));

    portSheer.push(new THREE.Vector3(-halfBeam, sheerY, z));
    stbdSheer.push(new THREE.Vector3(halfBeam, sheerY, z));

    for (let j = 0; j <= PROFILE_STEPS; j++) {
      // s in [-1, 1]: -1 = port gunwale, 0 = keel, +1 = starboard gunwale
      const s = (j / PROFILE_STEPS) * 2 - 1;
      const a = Math.abs(s);
      const sign = s < 0 ? -1 : 1;

      let x, y;
      if (a <= 0.55) {
        // Smooth V-bottom deadrise from keel to rounded chine
        const u = a / 0.55;
        const chineBeam = halfBeam * (0.87 - t * 0.16);
        x = sign * chineBeam * u;
        y = THREE.MathUtils.lerp(keelY, chineHeight, Math.pow(u, 1.18));
      } else {
        // Smooth flaring hull topside curving gracefully outward to sheer gunwale
        const u = (a - 0.55) / 0.45;
        const chineBeam = halfBeam * (0.87 - t * 0.16);
        const flare = Math.sin(u * Math.PI * 0.5);
        x = sign * THREE.MathUtils.lerp(chineBeam, halfBeam, flare);
        y = THREE.MathUtils.lerp(chineHeight, sheerY, Math.pow(u, 0.92));
      }
      positions.push(x, y, z);
    }
  }

  const ringSize = PROFILE_STEPS + 1;
  for (let i = 0; i < STATIONS; i++) {
    const a = i * ringSize;
    const b = (i + 1) * ringSize;
    for (let j = 0; j < PROFILE_STEPS; j++) {
      const v0 = a + j;
      const v1 = a + j + 1;
      const v2 = b + j;
      const v3 = b + j + 1;
      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }
  }

  // Smooth stern transom fan cap (station 0)
  const sternCenterIdx = positions.length / 3;
  positions.push(0, 0.55, Z_STERN);
  for (let j = 0; j < PROFILE_STEPS; j++) {
    indices.push(sternCenterIdx, j, j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Build continuous perimeter curve from port stern -> bow tip -> starboard stern
  const sheerCurvePoints = [...portSheer, ...stbdSheer.slice(0, -1).reverse()];
  return { hullGeo: geo, sheerCurvePoints };
}

function buildDeckContourShape(insetScale, zStart, zEnd) {
  const shape = new THREE.Shape();
  const steps = 18;
  const Z_STERN = 3.55;
  const Z_BOW = -4.65;

  const sampleW = (z) => {
    const t = THREE.MathUtils.clamp((Z_STERN - z) / (Z_STERN - Z_BOW), 0, 1);
    return hullBeamAt(t) * insetScale;
  };

  shape.moveTo(-sampleW(zStart), zStart);
  for (let i = 1; i <= steps; i++) {
    const z = THREE.MathUtils.lerp(zStart, zEnd, i / steps);
    shape.lineTo(-sampleW(z), z);
  }
  for (let i = steps; i >= 0; i--) {
    const z = THREE.MathUtils.lerp(zStart, zEnd, i / steps);
    shape.lineTo(sampleW(z), z);
  }
  shape.closePath();
  return shape;
}

/**
 * Creates a smoothly rounded-corner box with beveled edges (zero sharp rectangular corners).
 */
function createRoundedBoxGeo(w, h, d, radius = 0.1, bevelSegs = 4) {
  const r = Math.min(radius, w * 0.45, h * 0.45, d * 0.45);
  const hw = w * 0.5 - r;
  const hh = h * 0.5 - r;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh - r);
  shape.lineTo(hw, -hh - r);
  shape.quadraticCurveTo(hw + r, -hh - r, hw + r, -hh);
  shape.lineTo(hw + r, hh);
  shape.quadraticCurveTo(hw + r, hh + r, hw, hh + r);
  shape.lineTo(-hw, hh + r);
  shape.quadraticCurveTo(-hw - r, hh + r, -hw - r, hh);
  shape.lineTo(-hw - r, -hh);
  shape.quadraticCurveTo(-hw - r, -hh - r, -hw, -hh - r);

  const depth = Math.max(0.02, d - r * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: bevelSegs,
    curveSegments: 10
  });
  geo.center();
  return geo;
}

/**
 * Builds a sleek, aerodynamic sculpted V6 outboard motor (like Mercury Verado / Yamaha 300).
 */
function createSculptedOutboard(cowlMat, lowerMat, darkTrim, chromeMat, decalTex) {
  const pivot = new THREE.Group();

  // Transom clamp & hydraulic tilt rams
  const bracket = new THREE.Mesh(createRoundedBoxGeo(0.28, 0.34, 0.36, 0.05, 3), darkTrim);
  bracket.position.set(0, 0.02, -0.16);
  pivot.add(bracket);

  // Aerodynamic lofted cowling shell (16 height rings x 24 smooth radial segments)
  const rings = 16;
  const segs = 24;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let r = 0; r <= rings; r++) {
    const v = r / rings; // 0 = bottom pan, 1 = top crown
    const y = v * 0.96;

    // Sculpted automotive superellipse profile: widest in middle, smoothly domed top & tapered base
    const domeProfile = Math.sin(Math.pow(v, 0.72) * Math.PI * 0.94 + 0.14);
    const rx = 0.295 * (0.68 + 0.34 * domeProfile);
    const rz = 0.425 * (0.62 + 0.40 * domeProfile);
    // Subtle forward aerodynamic slant at the top
    const zCenter = 0.16 - Math.pow(v, 1.5) * 0.08;

    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Superellipse exponent makes sleek sculpted modern cowling shoulders (not a raw cylinder or box!)
      const exp = 0.74;
      const sx = Math.sign(cosT) * Math.pow(Math.abs(cosT), exp) * rx;
      const sz = Math.sign(sinT) * Math.pow(Math.abs(sinT), exp) * rz;

      // Taper rear slightly narrower than front
      const rearTaper = sz > 0 ? 0.90 : 1.04;
      pos.push(sx * rearTaper, y, zCenter + sz);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * (segs + 1) + s;
      const b = a + (segs + 1);
      idx.push(a, b, a + 1);
      idx.push(a + 1, b, b + 1);
    }
  }

  // Close top dome cleanly
  const topCenter = pos.length / 3;
  pos.push(0, 0.99, 0.09);
  uvs.push(0.5, 1.0);
  const lastRing = rings * (segs + 1);
  for (let s = 0; s < segs; s++) {
    idx.push(lastRing + s, topCenter, lastRing + s + 1);
  }

  const cowlGeo = new THREE.BufferGeometry();
  cowlGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cowlGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cowlGeo.setIndex(idx);
  cowlGeo.computeVertexNormals();

  const cowling = new THREE.Mesh(cowlGeo, cowlMat);
  cowling.castShadow = true;
  pivot.add(cowling);

  // Curved rear brand badge / decal plate conforming to back of cowling
  const rearDecalGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.42, 18, 1, true, -0.58, 1.16);
  const rearDecal = new THREE.Mesh(
    rearDecalGeo,
    new THREE.MeshStandardMaterial({
      map: decalTex,
      transparent: true,
      roughness: 0.25,
      metalness: 0.25
    })
  );
  rearDecal.position.set(0, 0.56, 0.315);
  pivot.add(rearDecal);

  // Sculpted tapered mid-section leg & hydrofoil lower gearcase
  const legGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.78, 16);
  legGeo.scale(0.82, 1.0, 1.65);
  const leg = new THREE.Mesh(legGeo, lowerMat);
  leg.position.set(0, -0.34, 0.12);
  pivot.add(leg);

  // Anti-cavitation hydrofoil fin
  const cavPlate = new THREE.Mesh(createRoundedBoxGeo(0.46, 0.035, 0.58, 0.015, 2), lowerMat);
  cavPlate.position.set(0, -0.56, 0.16);
  pivot.add(cavPlate);

  // Torpedo gearcase nose
  const torpedo = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.46, 8, 16), lowerMat);
  torpedo.rotation.x = Math.PI * 0.5;
  torpedo.position.set(0, -0.72, 0.18);
  pivot.add(torpedo);

  // Curved 3-blade stainless propeller
  const propGroup = new THREE.Group();
  propGroup.position.set(0, -0.72, 0.48);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.16, 14), chromeMat);
  hub.rotation.x = Math.PI * 0.5;
  propGroup.add(hub);

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.quadraticCurveTo(0.09, 0.09, 0.06, 0.22);
  bladeShape.quadraticCurveTo(0.0, 0.26, -0.05, 0.18);
  bladeShape.quadraticCurveTo(-0.04, 0.07, 0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });

  for (let b = 0; b < 3; b++) {
    const bg = new THREE.Group();
    bg.rotation.z = (b / 3) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeo, chromeMat);
    blade.rotation.y = 0.48;
    blade.position.y = 0.04;
    bg.add(blade);
    propGroup.add(bg);
  }
  pivot.add(propGroup);

  return { pivot, propGroup };
}

function createOrganicPerson({ shirtColor, hairColor, skinColor, hasBackLogo }) {
  const g = new THREE.Group();
  const shirtTex = createRashguardTexture(shirtColor, hasBackLogo);
  const shirtMat = new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.82 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.82 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.62 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.88 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.85 });

  // Rounded legs (capsules)
  for (const sx of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.48, 8, 14), shortsMat);
    leg.position.set(sx, 0.34, 0);
    g.add(leg);
  }

  // Smooth sculpted torso (tapered capsule/ellipsoid — zero boxy corners!)
  const torsoGeo = new THREE.CapsuleGeometry(0.20, 0.30, 10, 20);
  torsoGeo.scale(1.14, 1.0, 0.68);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.set(0, 0.94, 0);
  torso.rotation.y = Math.PI; // align back emblem cleanly facing +Z camera!
  torso.castShadow = true;
  g.add(torso);

  // Rounded shoulders & curved arms reaching forward to helm
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), sleeveMat);
    shoulder.position.set(side * 0.23, 1.12, 0.0);
    g.add(shoulder);

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.23, 1.10, 0.0),
      new THREE.Vector3(side * 0.27, 0.94, -0.14),
      new THREE.Vector3(side * 0.18, 0.92, -0.34)
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 14, 0.058, 12, false), sleeveMat);
    g.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), skinMat);
    hand.position.set(side * 0.18, 0.92, -0.35);
    g.add(hand);
  }

  // Smooth neck, sculpted head & hair
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.12, 14), skinMat);
  neck.position.set(0, 1.24, -0.01);
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.132, 18, 16), skinMat);
  head.scale.set(0.92, 1.08, 0.96);
  head.position.set(0, 1.39, -0.02);
  head.castShadow = true;
  g.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.138, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hair.scale.set(0.94, 1.06, 1.0);
  hair.position.set(0, 1.40, 0.0);
  g.add(hair);

  return g;
}

function createNonSlipDeckTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#dde4e8';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(130, 150, 165, 0.14)';
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      ctx.beginPath();
      ctx.arc(x + ((y / 8) % 2) * 4, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 12);
  return tex;
}

function createOutboardDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Silver top crest
  ctx.fillStyle = '#cfd8e0';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('V6 300', 128, 86);

  // Red marine stripe & emblem (echoing the red mark on the twin black motors in screenshot!)
  ctx.fillStyle = '#cc2233';
  ctx.fillRect(54, 108, 148, 16);
  ctx.fillStyle = '#e54858';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('MERCURY', 128, 162);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRashguardTexture(bgColor, hasBackLogo) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 256);

  if (hasBackLogo) {
    // Circular coastal graphic on back of driver's white long-sleeve shirt (matching screenshot!)
    const cx = 128;
    const cy = 112;
    ctx.strokeStyle = '#5a6a75';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#5a6a75';
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 12);
    ctx.quadraticCurveTo(cx, cy - 18, cx + 16, cy + 12);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFoamSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  // Soft overlapping organic foam puffs (no harsh dot or square edges!)
  const puffs = [
    [64, 64, 46, 0.55],
    [48, 56, 30, 0.40],
    [78, 60, 28, 0.38],
    [62, 78, 32, 0.35],
    [58, 46, 26, 0.32]
  ];
  for (const [x, y, r, a] of puffs) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.55, `rgba(235,250,255,${a * 0.5})`);
    g.addColorStop(1, 'rgba(220,248,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function createSpraySystem(scene) {
  const MAX_PARTICLES = 300;
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

  const foamTex = createFoamSpriteTexture();

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: foamTex }
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (290.0 / max(-mvPosition.z, 1.0));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        if (tex.a < 0.02) discard;
        gl_FragColor = vec4(tex.rgb, tex.a * vAlpha);
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

    // 1. Frothy prop wash right behind twin outboards
    if (absSpeed > 2.2) {
      const count = boosting ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const sideJitter = (Math.random() - 0.5) * 1.45;
        tmpPos.set(sideJitter, 0.08, 4.2 + Math.random() * 0.5).applyMatrix4(boatRoot.matrixWorld);
        const outSpread = sideJitter * 1.5;
        spawn(
          tmpPos.x,
          Math.max(tmpPos.y, waterY + 0.05),
          tmpPos.z,
          -forward.x * (absSpeed * 0.25 + 2.0) + right.x * outSpread + (Math.random() - 0.5) * 1.2,
          0.9 + Math.random() * (boosting ? 2.4 : 1.3),
          -forward.z * (absSpeed * 0.25 + 2.0) + right.z * outSpread + (Math.random() - 0.5) * 1.2,
          0.48 + Math.random() * 0.48,
          boosting ? 2.5 : 1.85
        );
      }
    }

    // 2. Smooth side chine spray curtains
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
          1.2 + Math.random() * 1.5,
          right.z * side * lateral + forward.z * (absSpeed * 0.32),
          0.40 + Math.random() * 0.34,
          1.5 + Math.random() * 0.75
        );
      }
    }

    // 3. Wave-jump splashdown plume
    if (splashBurst > 0.2) {
      const burstCount = Math.min(30, Math.floor(splashBurst * 20));
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
          0.58 + Math.random() * 0.45,
          2.2 + Math.random() * 1.3
        );
      }
    }

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
      positions[i * 3 + 1] = Math.max(p.y, waterY - 0.2);
      positions[i * 3 + 2] = p.z;
      sizes[i] = p.baseSize * (0.7 + t * 2.1);
      alphas[i] = Math.sin(t * Math.PI) * 0.72;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  return { points, update };
}
