import * as THREE from 'three';

export const TIME_PRESETS = {
  noon: {
    label: 'Sun: Noon',
    sunDir: new THREE.Vector3(0.32, 0.44, -0.84).normalize(),
    zenith: new THREE.Color('#0c438a'),
    midSky: new THREE.Color('#4492d2'),
    horizon: new THREE.Color('#d8eff6'),
    cloudLight: new THREE.Color('#ffffff'),
    cloudShadow: new THREE.Color('#5c7899'),
    sunColor: new THREE.Color('#fff9ea'),
    fogColor: new THREE.Color('#c2e4ee'),
    waterDeep: new THREE.Color('#06576e'),
    waterShallow: new THREE.Color('#18b6ba'),
    waterSss: new THREE.Color('#32edd9'),
    hemiSky: 0xace2ff,
    hemiGround: 0x16838e,
    dirIntensity: 3.1,
    ambientIntensity: 0.82
  },
  sunset: {
    label: 'Sun: Sunset',
    sunDir: new THREE.Vector3(0.45, 0.16, -0.88).normalize(),
    zenith: new THREE.Color('#1a396c'),
    midSky: new THREE.Color('#cc6c64'),
    horizon: new THREE.Color('#ffc27a'),
    cloudLight: new THREE.Color('#ffe5b4'),
    cloudShadow: new THREE.Color('#563e5e'),
    sunColor: new THREE.Color('#ffd488'),
    fogColor: new THREE.Color('#f4bc8c'),
    waterDeep: new THREE.Color('#0b3c58'),
    waterShallow: new THREE.Color('#1c8c94'),
    waterSss: new THREE.Color('#42c9bc'),
    hemiSky: 0xffc896,
    hemiGround: 0x1a5366,
    dirIntensity: 2.65,
    ambientIntensity: 0.7
  },
  dusk: {
    label: 'Sun: Vice Dusk',
    sunDir: new THREE.Vector3(-0.34, 0.13, -0.93).normalize(),
    zenith: new THREE.Color('#141948'),
    midSky: new THREE.Color('#7f3a80'),
    horizon: new THREE.Color('#ff7ea9'),
    cloudLight: new THREE.Color('#ffb2d4'),
    cloudShadow: new THREE.Color('#282148'),
    sunColor: new THREE.Color('#ffa2c8'),
    fogColor: new THREE.Color('#c96ca0'),
    waterDeep: new THREE.Color('#082848'),
    waterShallow: new THREE.Color('#167494'),
    waterSss: new THREE.Color('#38d6e6'),
    hemiSky: 0xd98cff,
    hemiGround: 0x123e5c,
    dirIntensity: 2.05,
    ambientIntensity: 0.66
  }
};

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Volumetric raymarched tropical cumulus clouds + Rayleigh/Mie scattering + crepuscular sunbeams!
const SKY_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uMidSky;
  uniform vec3 uHorizon;
  uniform vec3 uCloudLight;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunColor;
  uniform float uTime;

  varying vec3 vWorldDir;

  // Smooth 3D value-gradient noise (fast & isotropic for volumetric cloud raymarching)
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    // Quintic C2 Hermite interpolation (ultra-smooth, zero crease lines!)
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);
    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);
    return mix(nxy0, nxy1, u.z);
  }

  float cloudFbm(vec3 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.07 + vec3(13.1, 7.7, -9.4);
      a *= 0.48;
    }
    return v;
  }

  // Sculpted tropical cumulus cloud density inside atmospheric slab y in [0.9, 2.8]
  float sampleCloudDensity(vec3 p) {
    float h = clamp((p.y - 0.9) / 1.9, 0.0, 1.0);
    // Flat cumulus cloud base + billowy towering dome top!
    float heightProfile = smoothstep(0.0, 0.16, h) * (1.0 - smoothstep(0.52, 1.0, h));
    if (heightProfile <= 0.001) return 0.0;

    vec3 wind = vec3(uTime * 0.018, 0.0, uTime * 0.008);
    vec3 q = p * vec3(0.28, 0.42, 0.28) + wind;

    // Macro cumulus bank structure + billowy edge erosion
    float macro = cloudFbm(q);
    float detail = noise3(q * 3.6 - wind * 1.4);

    // Stronger anvil/cumulus buildup around horizon ring, clearer zenith sky
    float coverage = mix(0.45, 0.57, h);
    float d = macro - coverage + (detail - 0.5) * 0.20;
    return clamp(d * heightProfile * 3.1, 0.0, 1.0);
  }

  // Henyey-Greenstein forward scattering for luminous GTA VI silver cloud linings
  float hgPhase(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 0.001), 1.5));
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    vec3 sunDir = normalize(uSunDir);
    float y = clamp(dir.y, 0.0, 1.0);

    // Rayleigh-inspired deep tropical zenith -> pale cyan atmospheric horizon
    vec3 sky = mix(uHorizon, uMidSky, smoothstep(0.0, 0.24, y));
    sky = mix(sky, uZenith, smoothstep(0.18, 0.85, y));

    // Warm horizon aerial perspective glow
    float horizonGlow = pow(max(1.0 - y, 0.0001), 6.5);
    sky = mix(sky, uHorizon * 1.06, horizonGlow * 0.74);

    // Mie forward solar glow & dazzling HDR sun disc (triggers silky bloom!)
    float sunDot = max(dot(dir, sunDir), 0.0001);
    float mieGlow = pow(sunDot, 5.0) * 0.22 + pow(sunDot, 36.0) * 0.58 + pow(sunDot, 220.0) * 1.35;
    float sunDisc = smoothstep(0.9985, 0.99945, sunDot);
    sky += uSunColor * (mieGlow + sunDisc * 5.2);

    // Subtle diagonal crepuscular sunbeams radiating from upper-right sun
    vec3 sunRight = normalize(cross(vec3(0.0, 1.0, 0.0), sunDir));
    vec3 sunUp = cross(sunDir, sunRight);
    vec2 sunPlane = vec2(dot(dir, sunRight), dot(dir, sunUp));
    float rayAngle = atan(sunPlane.y, sunPlane.x);
    float rays = pow(0.5 + 0.5 * sin(rayAngle * 11.0 + uTime * 0.06), 3.0) *
                 pow(0.5 + 0.5 * cos(rayAngle * 7.0 - 0.8), 2.0);
    float rayMask = pow(sunDot, 7.0) * (1.0 - smoothstep(0.996, 0.9995, sunDot));
    sky += uSunColor * rays * rayMask * 0.32;

    // Raymarched Volumetric Cumulus Cloud Layer
    if (dir.y > 0.008) {
      // Intersect ray from camera (y = 0) with gently curved atmospheric cloud dome
      float elev = max(dir.y, 0.055);
      float tStart = 0.90 / elev;
      float tEnd = 2.80 / elev;
      // Cap ray length near horizon so clouds stay crisp & fast
      tEnd = min(tEnd, tStart + 16.0);

      const int STEPS = 14;
      float dt = (tEnd - tStart) / float(STEPS);

      // Smooth blue-noise-like jitter from ray angle to eliminate step banding
      float jitter = fract(sin(dot(dir.xz * 412.7, vec2(12.9898, 78.233))) * 43758.5453);
      float t = tStart + dt * jitter;

      float transmittance = 1.0;
      vec3 scatteredLight = vec3(0.0);

      float phase = mix(hgPhase(sunDot, 0.65), hgPhase(sunDot, -0.25), 0.35);
      float sunScatterBoost = clamp(0.62 + phase * 2.2, 0.55, 2.4);

      for (int i = 0; i < STEPS; i++) {
        vec3 pos = dir * t;
        float dens = sampleCloudDensity(pos);
        if (dens > 0.003) {
          // 2-tap directional sun shadow sample inside cloud volume
          float shadowDens = sampleCloudDensity(pos + sunDir * 0.55) * 0.7 +
                             sampleCloudDensity(pos + sunDir * 1.35) * 0.5;
          // Beer-Lambert + Beer-Powder effect gives bright fluffy white tops & cool shadowed undersides
          float beer = exp(-shadowDens * 2.65);
          float powder = 1.0 - exp(-dens * 4.5);
          float hNorm = clamp((pos.y - 0.9) / 1.9, 0.0, 1.0);
          float lit = clamp(beer * mix(0.65, 1.35, powder) * (0.45 + 0.65 * hNorm), 0.0, 1.0);

          vec3 ambientCloud = mix(uCloudShadow, uCloudLight * 0.92, hNorm * 0.72 + 0.14);
          vec3 directCloud = uCloudLight * uSunColor * sunScatterBoost * 1.15;
          vec3 sampleCol = mix(ambientCloud, directCloud, lit);

          float alpha = 1.0 - exp(-dens * dt * 0.78);
          scatteredLight += transmittance * sampleCol * alpha;
          transmittance *= (1.0 - alpha);
          if (transmittance < 0.03) break;
        }
        t += dt;
      }

      // Blend horizon clouds smoothly into atmospheric tropical mist
      float cloudAlpha = (1.0 - transmittance) * smoothstep(0.008, 0.085, dir.y);
      vec3 cloudFinal = scatteredLight / max(1.0 - transmittance, 0.0001);
      cloudFinal = mix(uHorizon * 1.02, cloudFinal, smoothstep(0.012, 0.13, dir.y));
      sky = mix(sky, cloudFinal, clamp(cloudAlpha, 0.0, 0.98));
    }

    if (dir.y < 0.0) {
      sky = mix(uHorizon, uMidSky * 0.55, clamp(-dir.y * 5.0, 0.0, 1.0));
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export function createSkySystem(scene) {
  const skyGeo = new THREE.SphereGeometry(2950, 64, 40);
  const preset = TIME_PRESETS.noon;

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: preset.sunDir.clone() },
      uZenith: { value: preset.zenith.clone() },
      uMidSky: { value: preset.midSky.clone() },
      uHorizon: { value: preset.horizon.clone() },
      uCloudLight: { value: preset.cloudLight.clone() },
      uCloudShadow: { value: preset.cloudShadow.clone() },
      uSunColor: { value: preset.sunColor.clone() },
      uTime: { value: 0 }
    }
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  const hemiLight = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.ambientIntensity);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(preset.sunColor, preset.dirIntensity);
  sunLight.position.copy(preset.sunDir).multiplyScalar(220);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 20;
  sunLight.shadow.camera.far = 480;
  const d = 55;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.00035;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const birds = createSeabirds(scene);

  function applyPreset(name) {
    const p = TIME_PRESETS[name] || TIME_PRESETS.noon;
    skyMat.uniforms.uSunDir.value.copy(p.sunDir);
    skyMat.uniforms.uZenith.value.copy(p.zenith);
    skyMat.uniforms.uMidSky.value.copy(p.midSky);
    skyMat.uniforms.uHorizon.value.copy(p.horizon);
    skyMat.uniforms.uCloudLight.value.copy(p.cloudLight);
    skyMat.uniforms.uCloudShadow.value.copy(p.cloudShadow);
    skyMat.uniforms.uSunColor.value.copy(p.sunColor);

    hemiLight.color.setHex(p.hemiSky);
    hemiLight.groundColor.setHex(p.hemiGround);
    hemiLight.intensity = p.ambientIntensity;
    sunLight.color.copy(p.sunColor);
    sunLight.intensity = p.dirIntensity;

    if (scene.fog) {
      scene.fog.color.copy(p.fogColor);
    }
    return p;
  }

  function update(time, focusPos, activePresetName) {
    const p = TIME_PRESETS[activePresetName] || TIME_PRESETS.noon;
    skyMat.uniforms.uTime.value = time;
    skyMesh.position.set(focusPos.x, 0, focusPos.z);

    sunLight.target.position.set(focusPos.x, 0, focusPos.z);
    sunLight.position
      .copy(p.sunDir)
      .multiplyScalar(220)
      .add(sunLight.target.position);

    birds.update(time, focusPos);
  }

  return { skyMesh, sunLight, hemiLight, applyPreset, update };
}

function createSeabirds(scene) {
  const birdGroup = new THREE.Group();
  const birds = [];
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8fa,
    roughness: 0.65,
    side: THREE.DoubleSide
  });

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.14);
  wingShape.quadraticCurveTo(0.45, 0.22, 1.08, -0.06);
  wingShape.quadraticCurveTo(0.55, -0.14, 0, -0.14);
  wingShape.closePath();
  const rightWingGeo = new THREE.ShapeGeometry(wingShape, 8);
  rightWingGeo.rotateX(-Math.PI * 0.5);

  const leftWingGeo = rightWingGeo.clone();
  leftWingGeo.scale(-1, 1, 1);

  const bodyGeo = new THREE.CapsuleGeometry(0.11, 0.55, 6, 10);
  bodyGeo.rotateX(Math.PI * 0.5);

  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, wingMat));
    const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
    const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
    g.add(leftWing, rightWing);

    const scale = 0.8 + (i % 4) * 0.22;
    g.scale.setScalar(scale);
    birdGroup.add(g);
    birds.push({
      mesh: g,
      leftWing,
      rightWing,
      angle: (i / 16) * Math.PI * 2,
      radius: 55 + (i % 5) * 42,
      altitude: 18 + (i % 6) * 7,
      speed: 0.11 + (i % 4) * 0.04,
      flapSpeed: 4.1 + (i % 3) * 0.9,
      phase: i * 1.7
    });
  }

  scene.add(birdGroup);

  return {
    update(time, focusPos) {
      for (const b of birds) {
        const a = b.angle + time * b.speed;
        const cx = focusPos.x + Math.cos(a) * b.radius;
        const cz = focusPos.z + Math.sin(a) * b.radius;
        const cy = b.altitude + Math.sin(time * 0.85 + b.phase) * 2.4;
        b.mesh.position.set(cx, cy, cz);
        b.mesh.rotation.y = -a;
        const flap = Math.sin(time * b.flapSpeed + b.phase) * 0.42;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
      }
    }
  };
}
