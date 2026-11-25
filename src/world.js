import * as THREE from 'three';
import { sampleOcean } from './waves.js';

/**
 * Generates the Leonida Keys / tropical archipelago world:
 * - Lush mangrove & palm islands positioned to echo the screenshot's opening vista
 * - Distant coastal skyline silhouette
 * - Anchored motor yachts & tall-masted cruising sailboats
 * - Bobbing channel buoys & wooden stunt jump ramps
 * - 12-checkpoint Island Run circuit with glowing 3D magenta waypoint markers
 */
export function createWorld(scene) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Island definitions (placed carefully around the open bay; player starts at (0, 0) facing -Z)
  const islandSpecs = [
    // Opening horizon islands (left mangrove key, far center key, right outer key — matching screenshot!)
    { x: -165, z: -210, radius: 46, height: 6.2, palms: 15, dock: true, tower: true },
    { x: -245, z: -175, radius: 34, height: 4.8, palms: 10, dock: false },
    { x: 42, z: -380, radius: 38, height: 5.4, palms: 12, dock: false },
    { x: 245, z: -265, radius: 42, height: 5.8, palms: 14, dock: true },
    // Outer circuit keys
    { x: 350, z: -85, radius: 54, height: 7.4, palms: 18, dock: true, lighthouse: true },
    { x: 315, z: 160, radius: 44, height: 6.0, palms: 14, dock: false },
    { x: 145, z: 295, radius: 48, height: 6.8, palms: 16, dock: true },
    { x: -95, z: 335, radius: 52, height: 7.0, palms: 17, dock: false },
    { x: -295, z: 230, radius: 46, height: 5.9, palms: 13, dock: true },
    { x: -375, z: 18, radius: 56, height: 7.8, palms: 18, dock: false },
    { x: -170, z: -485, radius: 58, height: 7.5, palms: 19, dock: true },
    { x: 215, z: -535, radius: 52, height: 6.6, palms: 16, dock: false },
    { x: -465, z: -345, radius: 62, height: 8.2, palms: 18, dock: false },
    { x: 515, z: -365, radius: 58, height: 7.2, palms: 16, dock: false }
  ];

  // Shared materials
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe3d2aa, roughness: 0.92 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3b6e35, roughness: 0.88 });
  const mangroveMat = new THREE.MeshStandardMaterial({ color: 0x2a5729, roughness: 0.9 });
  const mangroveBrightMat = new THREE.MeshStandardMaterial({ color: 0x3f7535, roughness: 0.86 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x735b43, roughness: 0.92 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x387832, roughness: 0.78, side: THREE.DoubleSide });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6948, roughness: 0.88 });

  const islands = [];
  let rng = 1337;
  const rand = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };

  for (const spec of islandSpecs) {
    const islandObj = buildIsland(spec, {
      sandMat, grassMat, mangroveMat, mangroveBrightMat, trunkMat, frondMat, woodMat, rand
    });
    worldGroup.add(islandObj);
    islands.push({ x: spec.x, z: spec.z, radius: spec.radius });
  }

  // Distant Vice City / Miami skyline along the northwestern horizon
  buildDistantSkyline(worldGroup);

  // NPC sailboats & yachts (including the iconic tall-masted sailboat on the right and yacht on the left!)
  const npcVessels = buildNpcVessels(worldGroup);

  // Red & green bobbing navigation buoys
  const buoys = buildChannelBuoys(worldGroup);

  // Floating wooden stunt jump ramps
  const ramps = buildJumpRamps(worldGroup);

  // 12-Checkpoint Island Run circuit (first waypoint straight ahead like the pink marker in screenshot!)
  const checkpoints = [
    new THREE.Vector3(-22, 0, -210),
    new THREE.Vector3(-85, 0, -350),
    new THREE.Vector3(65, 0, -470),
    new THREE.Vector3(245, 0, -405),
    new THREE.Vector3(365, 0, -215),
    new THREE.Vector3(235, 0, -45),
    new THREE.Vector3(215, 0, 145),
    new THREE.Vector3(65, 0, 225),
    new THREE.Vector3(-125, 0, 210),
    new THREE.Vector3(-245, 0, 75),
    new THREE.Vector3(-235, 0, -90),
    new THREE.Vector3(0, 0, -65)
  ];

  // 3D glowing magenta checkpoint ring + floating chevron
  const checkpointMarker = buildCheckpointMarker();
  worldGroup.add(checkpointMarker.group);

  function setActiveCheckpoint(pos, visible) {
    checkpointMarker.group.visible = visible;
    if (pos) {
      checkpointMarker.group.position.set(pos.x, 0, pos.z);
    }
  }

  function update(time, dt) {
    // Animate checkpoint ring & beacon
    if (checkpointMarker.group.visible) {
      checkpointMarker.ring.rotation.z = time * 0.9;
      checkpointMarker.chevron.rotation.y = time * 1.8;
      checkpointMarker.chevron.position.y = 7.8 + Math.sin(time * 3.0) * 0.85;
      const pulse = 1.0 + Math.sin(time * 4.2) * 0.06;
      checkpointMarker.ring.scale.setScalar(pulse);
    }

    // Bob & sail NPC vessels on real ocean waves
    for (const v of npcVessels) {
      if (v.orbitRadius > 0) {
        v.angle += v.orbitSpeed * dt;
        const nx = v.centerX + Math.cos(v.angle) * v.orbitRadius;
        const nz = v.centerZ + Math.sin(v.angle) * v.orbitRadius;
        const dx = nx - v.mesh.position.x;
        const dz = nz - v.mesh.position.z;
        v.mesh.position.x = nx;
        v.mesh.position.z = nz;
        if (Math.hypot(dx, dz) > 0.001) {
          v.mesh.rotation.y = Math.atan2(-dx, -dz);
        }
      }
      const w = sampleOcean(v.mesh.position.x, v.mesh.position.z, time);
      v.mesh.position.y = w.height + v.draftOffset;
      v.mesh.rotation.x = w.normal.z * 0.35;
      v.mesh.rotation.z = -w.normal.x * 0.35;
    }

    // Bob channel buoys
    for (const b of buoys) {
      const w = sampleOcean(b.mesh.position.x, b.mesh.position.z, time);
      b.mesh.position.y = w.height - 0.1;
      b.mesh.rotation.x = w.normal.z * 0.65;
      b.mesh.rotation.z = -w.normal.x * 0.65;
    }

    // Bob ramps subtly on ocean swells
    for (const r of ramps) {
      const w = sampleOcean(r.x, r.z, time);
      r.mesh.position.y = w.height - 0.15;
    }
  }

  return {
    islands,
    npcVessels,
    ramps,
    checkpoints,
    setActiveCheckpoint,
    update
  };
}

function buildIsland(spec, mats) {
  const { sandMat, grassMat, mangroveMat, mangroveBrightMat, trunkMat, frondMat, woodMat, rand } = mats;
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);

  // Sculpted organic sandy mound
  const sandGeo = new THREE.CylinderGeometry(spec.radius * 0.72, spec.radius * 1.06, spec.height, 26, 4);
  const posAttr = sandGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const angle = Math.atan2(vz, vx);
    const radialNoise = 1.0 + Math.sin(angle * 3.0 + spec.x) * 0.13 + Math.cos(angle * 5.0 + spec.z) * 0.08;
    const hNorm = (vy + spec.height * 0.5) / spec.height;
    posAttr.setX(i, vx * radialNoise);
    posAttr.setZ(i, vz * radialNoise);
    if (hNorm > 0.75) {
      posAttr.setY(i, vy + Math.sin(vx * 0.12) * Math.cos(vz * 0.12) * 0.9);
    }
  }
  sandGeo.computeVertexNormals();
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.position.y = spec.height * 0.25 - 1.3;
  sandMesh.receiveShadow = true;
  g.add(sandMesh);

  // Lush green inner crown
  const capGeo = new THREE.CylinderGeometry(spec.radius * 0.55, spec.radius * 0.78, spec.height * 0.65, 20);
  const capMesh = new THREE.Mesh(capGeo, grassMat);
  capMesh.position.y = spec.height * 0.42 - 0.6;
  capMesh.receiveShadow = true;
  g.add(capMesh);

  // Dense coastal mangrove clusters ringing the island (gives that lush Florida Keys silhouette)
  const bushCount = Math.floor(spec.radius * 0.75);
  const bushGeo = new THREE.DodecahedronGeometry(1.0, 1);
  for (let i = 0; i < bushCount; i++) {
    const a = (i / bushCount) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const dist = spec.radius * (0.42 + rand() * 0.48);
    const bx = Math.cos(a) * dist;
    const bz = Math.sin(a) * dist;
    const scale = 2.6 + rand() * 3.8;

    const bush = new THREE.Mesh(bushGeo, i % 2 === 0 ? mangroveMat : mangroveBrightMat);
    bush.position.set(bx, 1.4 + rand() * 1.8, bz);
    bush.scale.set(scale * 1.25, scale * (0.62 + rand() * 0.35), scale * 1.15);
    bush.rotation.y = rand() * Math.PI;
    bush.castShadow = true;
    bush.receiveShadow = true;
    g.add(bush);
  }

  // Tall swaying coconut palm trees
  for (let i = 0; i < spec.palms; i++) {
    const a = rand() * Math.PI * 2;
    const dist = spec.radius * (0.12 + rand() * 0.56);
    const palm = createPalmTree(trunkMat, frondMat, 9.5 + rand() * 6.5, rand);
    palm.position.set(Math.cos(a) * dist, spec.height * 0.42, Math.sin(a) * dist);
    palm.rotation.y = rand() * Math.PI * 2;
    g.add(palm);
  }

  // Optional wooden pier / dock jutting out into shallow turquoise water
  if (spec.dock) {
    const dockAngle = Math.atan2(-spec.z, -spec.x);
    const dockGroup = new THREE.Group();
    dockGroup.rotation.y = -dockAngle + Math.PI * 0.5;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 18), woodMat);
    plank.position.set(0, 1.15, spec.radius + 5);
    plank.castShadow = true;
    dockGroup.add(plank);
    for (let p = 0; p < 5; p++) {
      for (const sx of [-1.7, 1.7]) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 4.2, 8), woodMat);
        piling.position.set(sx, 0.2, spec.radius - 2 + p * 3.8);
        dockGroup.add(piling);
      }
    }
    g.add(dockGroup);
  }

  // Optional coastal watchtower / radio tower (visible on left island in screenshot!)
  if (spec.tower) {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xc8d2d8, roughness: 0.6 });
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 18, 6), towerMat);
    leg.position.set(4, spec.height + 7, -4);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.2), towerMat);
    cab.position.set(4, spec.height + 16, -4);
    g.add(leg, cab);
  }

  // Optional tropical striped lighthouse
  if (spec.lighthouse) {
    const lhWhite = new THREE.MeshStandardMaterial({ color: 0xf6f8fa, roughness: 0.45 });
    const lhRed = new THREE.MeshStandardMaterial({ color: 0xd93644, roughness: 0.45 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.4, 24, 16), lhWhite);
    base.position.set(0, spec.height + 10, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.75, 6, 16), lhRed);
    band.position.set(0, spec.height + 12, 0);
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.7, 3.0, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2b2 })
    );
    lantern.position.set(0, spec.height + 23.2, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.6, 12), lhRed);
    roof.position.set(0, spec.height + 26.0, 0);
    g.add(base, band, lantern, roof);
  }

  return g;
}

function createPalmTree(trunkMat, frondMat, height, rand) {
  const g = new THREE.Group();
  const segments = 5;
  const lean = 0.08 + rand() * 0.14;
  let curY = 0;
  let curZ = 0;

  for (let i = 0; i < segments; i++) {
    const segH = height / segments;
    const rBottom = 0.42 * (1 - i * 0.11);
    const rTop = 0.42 * (1 - (i + 1) * 0.11);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, segH * 1.08, 6), trunkMat);
    const tilt = lean * (i + 0.5);
    seg.position.set(0, curY + segH * 0.5, curZ + Math.sin(tilt) * segH * 0.5);
    seg.rotation.x = tilt;
    seg.castShadow = true;
    g.add(seg);
    curY += Math.cos(tilt) * segH;
    curZ += Math.sin(tilt) * segH;
  }

  // Crown of radiating palm fronds
  const crown = new THREE.Group();
  crown.position.set(0, curY, curZ);
  const frondCount = 7;
  for (let f = 0; f < frondCount; f++) {
    const fg = new THREE.Group();
    fg.rotation.y = (f / frondCount) * Math.PI * 2 + rand() * 0.25;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.4, 4), frondMat);
    blade.scale.set(1.0, 1.0, 0.16);
    blade.rotation.x = Math.PI * 0.62;
    blade.position.set(0, -0.35, 2.35);
    fg.add(blade);
    crown.add(fg);
  }
  g.add(crown);
  return g;
}

function buildDistantSkyline(parent) {
  const skyline = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color: 0xb7cedb, roughness: 0.7 });
  const matB = new THREE.MeshStandardMaterial({ color: 0x99b7c9, roughness: 0.75 });

  // Place Miami/Vice-style coastal towers far across the northern horizon
  for (let i = 0; i < 42; i++) {
    const angle = -Math.PI * 0.72 + (i / 42) * Math.PI * 0.55;
    const dist = 1020 + (i % 4) * 55;
    const h = 24 + Math.abs(Math.sin(i * 1.9)) * 74 + (i % 7 === 0 ? 35 : 0);
    const w = 14 + (i % 5) * 6;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), i % 2 === 0 ? matA : matB);
    tower.position.set(Math.cos(angle) * dist, h * 0.5 - 3, Math.sin(angle) * dist);
    skyline.add(tower);
  }
  parent.add(skyline);
}

function buildNpcVessels(parent) {
  const vessels = [];
  const hullWhite = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.35 });
  const hullNavy = new THREE.MeshStandardMaterial({ color: 0x1d3548, roughness: 0.42 });
  const woodDeck = new THREE.MeshStandardMaterial({ color: 0x8d6c49, roughness: 0.85 });
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x1b2c38, roughness: 0.15, metalness: 0.5 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x454d55, roughness: 0.5 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.85, side: THREE.DoubleSide });

  function makeSailboat(withSailsUp) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.35, 13.5), hullNavy);
    hull.position.y = 0.55;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.25, 13.2), woodDeck);
    deck.position.y = 1.28;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 5.2), hullWhite);
    cabin.position.set(0, 1.75, 0.5);
    // Tall mast (iconic silhouette on right horizon in screenshot!)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 19.5, 8), mastMat);
    mast.position.set(0, 10.6, -0.5);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.2, 8), mastMat);
    boom.rotation.x = Math.PI * 0.5;
    boom.position.set(0, 3.2, 2.6);
    g.add(hull, deck, cabin, mast, boom);

    if (withSailsUp) {
      const sailShape = new THREE.Shape();
      sailShape.moveTo(0, 0);
      sailShape.lineTo(0, 15.5);
      sailShape.lineTo(5.8, 0.4);
      sailShape.closePath();
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMat);
      sail.rotation.y = -Math.PI * 0.5;
      sail.position.set(0.08, 3.3, -0.4);
      g.add(sail);
    }
    return g;
  }

  function makeMotorYacht() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.7, 14.2), hullWhite);
    hull.position.y = 0.72;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.26, 0.35, 13.8), hullNavy);
    stripe.position.y = 0.35;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.65, 7.2), hullWhite);
    cabin.position.set(0, 2.35, 0.4);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(3.48, 0.65, 6.0), glassDark);
    windows.position.set(0, 2.55, 0.1);
    const flybridge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 3.8), hullWhite);
    flybridge.position.set(0, 3.55, 1.1);
    g.add(hull, stripe, cabin, windows, flybridge);
    return g;
  }

  // 1. Anchored tall-masted sailboat on right side (mirrors screenshot right horizon!)
  const heroSail = makeSailboat(false);
  heroSail.position.set(112, 0, -148);
  heroSail.rotation.y = Math.PI * 0.46;
  parent.add(heroSail);
  vessels.push({ mesh: heroSail, orbitRadius: 0, centerX: 112, centerZ: -148, angle: 0, orbitSpeed: 0, draftOffset: -0.15 });

  // 2. Anchored white motor yacht near left mangrove island (mirrors screenshot left island!)
  const heroYacht = makeMotorYacht();
  heroYacht.position.set(-96, 0, -162);
  heroYacht.rotation.y = -0.5;
  parent.add(heroYacht);
  vessels.push({ mesh: heroYacht, orbitRadius: 0, centerX: -96, centerZ: -162, angle: 0, orbitSpeed: 0, draftOffset: -0.25 });

  // 3. Cruising sailboats & yachts across the open bay
  const patrolConfigs = [
    { type: 'sail', cx: 140, cz: -310, r: 95, speed: 0.045, a: 0.8 },
    { type: 'yacht', cx: -190, cz: 45, r: 110, speed: -0.055, a: 2.1 },
    { type: 'sail', cx: 185, cz: 135, r: 85, speed: 0.04, a: 4.0 },
    { type: 'yacht', cx: -35, cz: 215, r: 90, speed: 0.06, a: 1.2 },
    { type: 'sail', cx: -290, cz: -280, r: 100, speed: -0.042, a: 5.1 }
  ];

  for (const cfg of patrolConfigs) {
    const m = cfg.type === 'sail' ? makeSailboat(true) : makeMotorYacht();
    m.position.set(cfg.cx + Math.cos(cfg.a) * cfg.r, 0, cfg.cz + Math.sin(cfg.a) * cfg.r);
    parent.add(m);
    vessels.push({
      mesh: m,
      orbitRadius: cfg.r,
      centerX: cfg.cx,
      centerZ: cfg.cz,
      angle: cfg.a,
      orbitSpeed: cfg.speed,
      draftOffset: -0.2
    });
  }

  return vessels;
}

function buildChannelBuoys(parent) {
  const buoys = [];
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.4 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x22b573, roughness: 0.4 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.5 });

  const positions = [
    { x: -38, z: -118, red: true },
    { x: 46, z: -115, red: false },
    { x: -64, z: -260, red: true },
    { x: 18, z: -268, red: false },
    { x: 160, z: -160, red: true },
    { x: 245, z: -120, red: false },
    { x: 120, z: 110, red: true },
    { x: -135, z: 95, red: false }
  ];

  for (const p of positions) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.4, 12), p.red ? redMat : greenMat);
    base.position.y = 0.35;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.5, 8), whiteMat);
    pole.position.y = 1.9;
    const top = new THREE.Mesh(
      p.red ? new THREE.ConeGeometry(0.45, 0.85, 8) : new THREE.BoxGeometry(0.7, 0.7, 0.7),
      p.red ? redMat : greenMat
    );
    top.position.y = 3.35;
    g.add(base, pole, top);
    g.position.set(p.x, 0, p.z);
    parent.add(g);
    buoys.push({ mesh: g });
  }
  return buoys;
}

function buildJumpRamps(parent) {
  const ramps = [];
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xd9a76a, roughness: 0.78 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff3b93, roughness: 0.45 });
  const floatMat = new THREE.MeshStandardMaterial({ color: 0x28323c, roughness: 0.6 });

  const specs = [
    { x: 12, z: -145, rotY: 0.12 },
    { x: 295, z: -310, rotY: -0.65 },
    { x: 165, z: 225, rotY: -2.4 },
    { x: -195, z: 15, rotY: 3.0 }
  ];

  for (const s of specs) {
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.rotY;

    // Sloped ramp deck (10m wide, 14m long, rises from y=0 to y=2.8m toward -Z)
    const rampDeck = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.45, 14.5), deckMat);
    rampDeck.position.set(0, 1.35, 0);
    rampDeck.rotation.x = 0.21;
    rampDeck.castShadow = true;
    rampDeck.receiveShadow = true;
    g.add(rampDeck);

    // High-visibility magenta racing chevrons on sides
    for (const sx of [-5.1, 5.1]) {
      const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.65, 14.5), stripeMat);
      sideTrim.position.set(sx, 1.45, 0);
      sideTrim.rotation.x = 0.21;
      g.add(sideTrim);

      const pontoon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 14.8, 10), floatMat);
      pontoon.rotation.x = Math.PI * 0.5;
      pontoon.position.set(sx * 0.94, 0.0, 0);
      g.add(pontoon);
    }

    parent.add(g);
    ramps.push({
      mesh: g,
      x: s.x,
      z: s.z,
      rotY: s.rotY,
      halfWidth: 5.5,
      halfLength: 7.5
    });
  }
  return ramps;
}

function buildCheckpointMarker() {
  const group = new THREE.Group();

  // Wide glowing magenta ring skimming the water surface
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff3b93,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(11.5, 13.4, 48), ringMat);
  ring.rotation.x = -Math.PI * 0.5;
  ring.position.y = 0.65;
  group.add(ring);

  // Subtle vertical translucent beacon cylinder
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff4ca0,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.2, 18, 32, 1, true), beamMat);
  beam.position.y = 9.0;
  group.add(beam);

  // Floating 3D pink diamond/chevron beacon above the ring
  const chevron = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xff3898 })
  );
  chevron.scale.set(1.0, 1.35, 1.0);
  chevron.position.y = 7.8;
  group.add(chevron);

  return { group, ring, beam, chevron };
}
