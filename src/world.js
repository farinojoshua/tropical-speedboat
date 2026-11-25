import * as THREE from 'three';
import { sampleOcean } from './waves.js';

/**
 * Generates the organic Leonida Keys tropical archipelago:
 * - Smooth heightmap-sculpted sandy islands with vertex-colored beaches & lush turf (no cylinders!)
 * - Soft organic mangrove foliage canopies & smoothly curved arched coconut palms
 * - Pointed-bow curved sailboats & luxury motor yachts (no box hulls!)
 * - Bobbing channel buoys, rounded jump ramps, and 12-checkpoint Island Run circuit
 */
export function createWorld(scene) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const islandSpecs = [
    { x: -165, z: -210, radius: 46, height: 6.2, palms: 15, dock: true, tower: true },
    { x: -245, z: -175, radius: 34, height: 4.8, palms: 10, dock: false },
    { x: 42, z: -380, radius: 38, height: 5.4, palms: 12, dock: false },
    { x: 245, z: -265, radius: 42, height: 5.8, palms: 14, dock: true },
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

  // Shared organic materials
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02
  });
  const mangroveMats = [
    new THREE.MeshStandardMaterial({ color: 0x265428, roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: 0x326630, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x417a38, roughness: 0.84 })
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x765e46, roughness: 0.92 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x3b7d34,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6a48, roughness: 0.86 });

  // Pre-build smooth organic foliage blob geometry (reused across islands for 60fps performance)
  const organicCanopyGeo = buildOrganicCanopyGeometry();
  const curvedFrondGeo = buildCurvedPalmFrondGeometry();

  const islands = [];
  let rng = 1337;
  const rand = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };

  for (const spec of islandSpecs) {
    const islandObj = buildSmoothIsland(spec, {
      terrainMat,
      mangroveMats,
      organicCanopyGeo,
      trunkMat,
      frondMat,
      curvedFrondGeo,
      woodMat,
      rand
    });
    worldGroup.add(islandObj);
    islands.push({ x: spec.x, z: spec.z, radius: spec.radius });
  }

  // Distant coastal city skyline
  buildDistantSkyline(worldGroup);

  // Smooth sculpted NPC sailboats & yachts
  const npcVessels = buildNpcVessels(worldGroup);

  // Bobbing channel buoys
  const buoys = buildChannelBuoys(worldGroup);

  // Stunt jump ramps
  const ramps = buildJumpRamps(worldGroup);

  // 12-Checkpoint Island Run circuit
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

  const checkpointMarker = buildCheckpointMarker();
  worldGroup.add(checkpointMarker.group);

  function setActiveCheckpoint(pos, visible) {
    checkpointMarker.group.visible = visible;
    if (pos) {
      checkpointMarker.group.position.set(pos.x, 0, pos.z);
    }
  }

  function update(time, dt) {
    if (checkpointMarker.group.visible) {
      checkpointMarker.ring.rotation.z = time * 0.9;
      checkpointMarker.chevron.rotation.y = time * 1.8;
      checkpointMarker.chevron.position.y = 7.8 + Math.sin(time * 3.0) * 0.85;
      const pulse = 1.0 + Math.sin(time * 4.2) * 0.06;
      checkpointMarker.ring.scale.setScalar(pulse);
    }

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

    for (const b of buoys) {
      const w = sampleOcean(b.mesh.position.x, b.mesh.position.z, time);
      b.mesh.position.y = w.height - 0.1;
      b.mesh.rotation.x = w.normal.z * 0.65;
      b.mesh.rotation.z = -w.normal.x * 0.65;
    }

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

/**
 * Smooth organic heightmap island (polar radial grid with gently sloped sandy beaches
 * blending into lush grassy mounds — zero flat cylinder edges!).
 */
function buildSmoothIsland(spec, ctx) {
  const { terrainMat, mangroveMats, organicCanopyGeo, trunkMat, frondMat, curvedFrondGeo, woodMat, rand } = ctx;
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);

  const rings = 14;
  const segs = 40;
  const positions = [];
  const colors = [];
  const indices = [];

  const wetSand = new THREE.Color(0xc2b28b);
  const drySand = new THREE.Color(0xe6d6af);
  const turfCol = new THREE.Color(0x3a6f35);
  const tmpCol = new THREE.Color();

  const coastRadius = (angle) =>
    spec.radius *
    (1.0 +
      Math.sin(angle * 2.0 + spec.x * 0.05) * 0.12 +
      Math.cos(angle * 3.0 + spec.z * 0.04) * 0.09 +
      Math.sin(angle * 5.0 + spec.x * 0.1) * 0.04);

  // Center crown vertex
  const centerH = spec.height * 0.85;
  positions.push(0, centerH, 0);
  colors.push(turfCol.r, turfCol.g, turfCol.b);

  for (let r = 1; r <= rings; r++) {
    const rn = r / rings; // 0 -> 1.18 (submerged gentle beach slope)
    const radialFrac = rn * 1.18;
    for (let s = 0; s < segs; s++) {
      const angle = (s / segs) * Math.PI * 2;
      const rad = coastRadius(angle) * radialFrac;
      const vx = Math.cos(angle) * rad;
      const vz = Math.sin(angle) * rad;

      // Smooth cosine dome sloping gracefully underwater beyond coastline
      let h;
      if (radialFrac <= 1.0) {
        const hill = Math.pow(Math.cos(radialFrac * Math.PI * 0.5), 1.35) * spec.height;
        const undulation = (Math.sin(vx * 0.09 + spec.x) * Math.cos(vz * 0.09 + spec.z)) * 0.55 * (1 - radialFrac);
        h = hill + undulation;
      } else {
        // Gentle submerged sandy shelf
        h = -(radialFrac - 1.0) * 14.0;
      }

      positions.push(vx, h, vz);

      // Smooth biome vertex color transition
      if (h < 0.35) {
        tmpCol.copy(wetSand).lerp(drySand, THREE.MathUtils.clamp((h + 1.2) / 1.55, 0, 1));
      } else if (h < 1.8) {
        tmpCol.copy(drySand).lerp(turfCol, THREE.MathUtils.smoothstep(h, 0.35, 1.8));
      } else {
        tmpCol.copy(turfCol);
      }
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  // Center fan triangles
  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    indices.push(0, 1 + next, 1 + s);
  }
  // Ring quads
  for (let r = 0; r < rings - 1; r++) {
    const rowA = 1 + r * segs;
    const rowB = 1 + (r + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      indices.push(rowA + s, rowA + next, rowB + s);
      indices.push(rowA + next, rowB + next, rowB + s);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const islandMesh = new THREE.Mesh(geo, terrainMat);
  islandMesh.receiveShadow = true;
  g.add(islandMesh);

  // Soft organic mangrove foliage clusters along the tropical shoreline
  const bushCount = Math.floor(spec.radius * 0.72);
  for (let i = 0; i < bushCount; i++) {
    const a = (i / bushCount) * Math.PI * 2 + (rand() - 0.5) * 0.22;
    const frac = 0.34 + rand() * 0.48;
    const dist = coastRadius(a) * frac;
    const bx = Math.cos(a) * dist;
    const bz = Math.sin(a) * dist;
    const scale = 2.8 + rand() * 3.6;
    const groundY = Math.pow(Math.cos(frac * Math.PI * 0.5), 1.35) * spec.height;

    const bush = new THREE.Mesh(organicCanopyGeo, mangroveMats[i % mangroveMats.length]);
    bush.position.set(bx, Math.max(0.9, groundY + scale * 0.28), bz);
    bush.scale.set(scale * 1.35, scale * (0.68 + rand() * 0.28), scale * 1.25);
    bush.rotation.y = rand() * Math.PI * 2;
    bush.castShadow = true;
    bush.receiveShadow = true;
    g.add(bush);
  }

  // Smoothly curved swaying coconut palm trees with drooping arched fronds
  for (let i = 0; i < spec.palms; i++) {
    const a = rand() * Math.PI * 2;
    const frac = 0.12 + rand() * 0.52;
    const dist = coastRadius(a) * frac;
    const groundY = Math.pow(Math.cos(frac * Math.PI * 0.5), 1.35) * spec.height;
    const palm = createSmoothPalmTree(trunkMat, frondMat, curvedFrondGeo, 9.5 + rand() * 6.5, rand);
    palm.position.set(Math.cos(a) * dist, Math.max(1.0, groundY - 0.3), Math.sin(a) * dist);
    palm.rotation.y = a + (rand() - 0.5) * 1.2;
    g.add(palm);
  }

  // Optional wooden pier / dock
  if (spec.dock) {
    const dockAngle = Math.atan2(-spec.z, -spec.x);
    const dockGroup = new THREE.Group();
    dockGroup.rotation.y = -dockAngle + Math.PI * 0.5;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.32, 18), woodMat);
    plank.position.set(0, 1.15, spec.radius + 5);
    plank.castShadow = true;
    dockGroup.add(plank);
    for (let p = 0; p < 5; p++) {
      for (const sx of [-1.7, 1.7]) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 4.2, 12), woodMat);
        piling.position.set(sx, 0.2, spec.radius - 2 + p * 3.8);
        dockGroup.add(piling);
      }
    }
    g.add(dockGroup);
  }

  // Optional coastal watchtower
  if (spec.tower) {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xd0dadf, roughness: 0.55 });
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 18, 14), towerMat);
    leg.position.set(4, spec.height + 6, -4);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.7, 2.2, 16), towerMat);
    cab.position.set(4, spec.height + 15.5, -4);
    g.add(leg, cab);
  }

  // Optional tropical striped lighthouse
  if (spec.lighthouse) {
    const lhWhite = new THREE.MeshStandardMaterial({ color: 0xf6f8fa, roughness: 0.4 });
    const lhRed = new THREE.MeshStandardMaterial({ color: 0xd93644, roughness: 0.42 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.4, 24, 24), lhWhite);
    base.position.set(0, spec.height + 9.5, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.75, 6, 24), lhRed);
    band.position.set(0, spec.height + 11.5, 0);
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.7, 3.0, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b2 })
    );
    lantern.position.set(0, spec.height + 22.7, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.35, 2.8, 20), lhRed);
    roof.position.set(0, spec.height + 25.6, 0);
    g.add(base, band, lantern, roof);
  }

  return g;
}

/**
 * Smooth organic billowing foliage sphere (zero sharp faceted dodecahedron edges!).
 */
function buildOrganicCanopyGeometry() {
  const geo = new THREE.SphereGeometry(1.0, 16, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lobe = 1.0 + Math.sin(x * 3.1 + y * 2.3) * 0.14 + Math.cos(z * 2.9 - y * 2.1) * 0.12;
    const flatBottom = y < -0.2 ? 0.65 : 1.0;
    pos.setXYZ(i, x * lobe, y * lobe * flatBottom, z * lobe);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Arched drooping tropical palm frond mesh.
 */
function buildCurvedPalmFrondGeometry() {
  const segs = 10;
  const len = 5.4;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = t * len;
    // Graceful upward-then-drooping parabolic frond arch
    const y = Math.sin(t * Math.PI * 0.85) * 1.15 - t * t * 1.65;
    const halfW = Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.92;
    // Subtle V-fold along center spine
    const droopEdge = -halfW * 0.25;

    positions.push(
      -halfW, y + droopEdge, z,
      0, y + 0.08, z,
      halfW, y + droopEdge, z
    );
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createSmoothPalmTree(trunkMat, frondMat, curvedFrondGeo, height, rand) {
  const g = new THREE.Group();
  const leanDist = 1.6 + rand() * 2.6;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, height * 0.35, leanDist * 0.28),
    new THREE.Vector3(0, height * 0.72, leanDist * 0.68),
    new THREE.Vector3(0, height, leanDist)
  ]);

  // Smooth tapered curved trunk
  const trunkGeo = new THREE.TubeGeometry(curve, 14, 0.32, 10, false);
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(y / height, 0, 1);
    const center = curve.getPoint(t);
    const taper = THREE.MathUtils.lerp(1.25, 0.45, t);
    pos.setX(i, center.x + (pos.getX(i) - center.x) * taper);
    pos.setZ(i, center.z + (pos.getZ(i) - center.z) * taper);
  }
  trunkGeo.computeVertexNormals();

  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  g.add(trunk);

  // Crown of graceful arched fronds
  const crown = new THREE.Group();
  crown.position.set(0, height, leanDist);
  const frondCount = 8;
  for (let f = 0; f < frondCount; f++) {
    const frond = new THREE.Mesh(curvedFrondGeo, frondMat);
    frond.rotation.y = (f / frondCount) * Math.PI * 2 + rand() * 0.25;
    frond.rotation.x = -0.15 + (f % 2) * 0.22;
    crown.add(frond);
  }
  g.add(crown);
  return g;
}

function buildDistantSkyline(parent) {
  const skyline = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color: 0xc2d8e4, roughness: 0.65 });
  const matB = new THREE.MeshStandardMaterial({ color: 0xa4c2d4, roughness: 0.72 });

  for (let i = 0; i < 42; i++) {
    const angle = -Math.PI * 0.72 + (i / 42) * Math.PI * 0.55;
    const dist = 1040 + (i % 4) * 55;
    const h = 24 + Math.abs(Math.sin(i * 1.9)) * 72 + (i % 7 === 0 ? 36 : 0);
    const w = 13 + (i % 5) * 5;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), i % 2 === 0 ? matA : matB);
    tower.position.set(Math.cos(angle) * dist, h * 0.5 - 3, Math.sin(angle) * dist);
    skyline.add(tower);
  }
  parent.add(skyline);
}

/**
 * Builds smooth curved pointed-bow hull geometry for NPC sailboats & yachts (zero rectangular boxes!).
 */
function buildCurvedVesselHullGeo(length, beam, depth) {
  const hl = length * 0.5;
  const hb = beam * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hb * 0.82, hl);
  shape.quadraticCurveTo(-hb * 1.05, 0, -hb * 0.65, -hl * 0.55);
  shape.quadraticCurveTo(-hb * 0.25, -hl * 0.92, 0, -hl);
  shape.quadraticCurveTo(hb * 0.25, -hl * 0.92, hb * 0.65, -hl * 0.55);
  shape.quadraticCurveTo(hb * 1.05, 0, hb * 0.82, hl);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.28,
    bevelSize: 0.22,
    bevelSegments: 4,
    curveSegments: 20
  });
  geo.rotateX(Math.PI * 0.5);
  return geo;
}

function buildNpcVessels(parent) {
  const vessels = [];
  const hullWhite = new THREE.MeshPhysicalMaterial({ color: 0xf4f7f9, roughness: 0.2, clearcoat: 0.85 });
  const hullNavy = new THREE.MeshPhysicalMaterial({ color: 0x1b3449, roughness: 0.24, clearcoat: 0.8 });
  const woodDeck = new THREE.MeshStandardMaterial({ color: 0x94734f, roughness: 0.82 });
  const glassDark = new THREE.MeshPhysicalMaterial({ color: 0x172936, roughness: 0.08, metalness: 0.25, clearcoat: 1.0 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x454e56, roughness: 0.4, metalness: 0.5 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.82, side: THREE.DoubleSide });

  const sailHullGeo = buildCurvedVesselHullGeo(14.5, 3.8, 1.25);
  const yachtHullGeo = buildCurvedVesselHullGeo(15.2, 4.4, 1.55);

  function makeSailboat(withSailsUp) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(sailHullGeo, hullNavy);
    hull.position.y = 1.28;
    const deck = new THREE.Mesh(buildCurvedVesselHullGeo(13.6, 3.3, 0.14), woodDeck);
    deck.position.y = 1.48;
    const cabin = new THREE.Mesh(buildCurvedVesselHullGeo(5.8, 2.2, 0.72), hullWhite);
    cabin.position.set(0, 2.15, 0.5);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 20.0, 14), mastMat);
    mast.position.set(0, 10.8, -0.5);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.2, 10), mastMat);
    boom.rotation.x = Math.PI * 0.5;
    boom.position.set(0, 3.2, 2.6);
    g.add(hull, deck, cabin, mast, boom);

    if (withSailsUp) {
      // Gently billowing curved mainsail
      const sailGeo = new THREE.PlaneGeometry(5.8, 15.6, 8, 12);
      const pos = sailGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + 2.9; // 0..5.8
        const y = pos.getY(i) + 7.8; // 0..15.6
        const maxW = Math.max(0.05, 5.8 * (1 - y / 15.8));
        const clampedX = Math.min(x, maxW);
        const billow = Math.sin((clampedX / maxW) * Math.PI) * Math.sin((y / 15.6) * Math.PI) * 0.9;
        pos.setXYZ(i, billow, y, clampedX);
      }
      sailGeo.computeVertexNormals();
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.position.set(0.05, 3.3, -0.45);
      g.add(sail);
    }
    return g;
  }

  function makeMotorYacht() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(yachtHullGeo, hullWhite);
    hull.position.y = 1.55;

    const cabin = new THREE.Mesh(buildCurvedVesselHullGeo(8.2, 3.4, 1.35), hullWhite);
    cabin.position.set(0, 2.85, 0.4);

    const windows = new THREE.Mesh(buildCurvedVesselHullGeo(6.8, 3.48, 0.55), glassDark);
    windows.position.set(0, 2.65, 0.1);

    const flybridge = new THREE.Mesh(buildCurvedVesselHullGeo(4.4, 2.5, 0.68), hullWhite);
    flybridge.position.set(0, 3.65, 1.1);

    g.add(hull, cabin, windows, flybridge);
    return g;
  }

  // 1. Anchored tall-masted sailboat on right horizon (mirrors screenshot!)
  const heroSail = makeSailboat(false);
  heroSail.position.set(112, 0, -148);
  heroSail.rotation.y = Math.PI * 0.46;
  parent.add(heroSail);
  vessels.push({ mesh: heroSail, orbitRadius: 0, centerX: 112, centerZ: -148, angle: 0, orbitSpeed: 0, draftOffset: -0.25 });

  // 2. Anchored motor yacht near left mangrove island
  const heroYacht = makeMotorYacht();
  heroYacht.position.set(-96, 0, -162);
  heroYacht.rotation.y = -0.5;
  parent.add(heroYacht);
  vessels.push({ mesh: heroYacht, orbitRadius: 0, centerX: -96, centerZ: -162, angle: 0, orbitSpeed: 0, draftOffset: -0.35 });

  // 3. Cruising sailboats & yachts
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
      draftOffset: -0.25
    });
  }

  return vessels;
}

function buildChannelBuoys(parent) {
  const buoys = [];
  const redMat = new THREE.MeshPhysicalMaterial({ color: 0xe63946, roughness: 0.35, clearcoat: 0.5 });
  const greenMat = new THREE.MeshPhysicalMaterial({ color: 0x22b573, roughness: 0.35, clearcoat: 0.5 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.45 });

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
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.05, 1.4, 20), p.red ? redMat : greenMat);
    base.position.y = 0.35;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.5, 14), whiteMat);
    pole.position.y = 1.9;
    const top = new THREE.Mesh(
      p.red ? new THREE.ConeGeometry(0.45, 0.85, 16) : new THREE.CylinderGeometry(0.36, 0.36, 0.72, 16),
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
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xd9a76a, roughness: 0.74 });
  const stripeMat = new THREE.MeshPhysicalMaterial({ color: 0xff3b93, roughness: 0.35, clearcoat: 0.6 });
  const floatMat = new THREE.MeshStandardMaterial({ color: 0x26303a, roughness: 0.5 });

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

    const rampDeck = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.42, 14.5), deckMat);
    rampDeck.position.set(0, 1.35, 0);
    rampDeck.rotation.x = 0.21;
    rampDeck.castShadow = true;
    rampDeck.receiveShadow = true;
    g.add(rampDeck);

    for (const sx of [-5.1, 5.1]) {
      const sideTrim = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 14.2, 8, 12), stripeMat);
      sideTrim.rotation.x = Math.PI * 0.5 + 0.21;
      sideTrim.position.set(sx, 1.48, 0);
      g.add(sideTrim);

      const pontoon = new THREE.Mesh(new THREE.CapsuleGeometry(0.54, 14.2, 8, 16), floatMat);
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

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff3b93,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(11.5, 13.4, 64), ringMat);
  ring.rotation.x = -Math.PI * 0.5;
  ring.position.y = 0.65;
  group.add(ring);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff4ca0,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.2, 18, 48, 1, true), beamMat);
  beam.position.y = 9.0;
  group.add(beam);

  const chevron = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xff3898 })
  );
  chevron.scale.set(1.0, 1.35, 1.0);
  chevron.position.y = 7.8;
  group.add(chevron);

  return { group, ring, beam, chevron };
}
