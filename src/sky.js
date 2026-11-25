import * as THREE from 'three';

export const TIME_PRESETS = {
  noon: {
    label: 'Sun: Noon',
    sunDir: new THREE.Vector3(0.32, 0.44, -0.84).normalize(),
    zenith: new THREE.Color('#134d92'),
    midSky: new THREE.Color('#4a95cf'),
    horizon: new THREE.Color('#d2ebf2'),
    cloudLight: new THREE.Color('#ffffff'),
    cloudShadow: new THREE.Color('#667e99'),
    sunColor: new THREE.Color('#fff9e6'),
    fogColor: new THREE.Color('#b8dfe9'),
    waterDeep: new THREE.Color('#095c72'),
    waterShallow: new THREE.Color('#1db7ba'),
    waterSss: new THREE.Color('#34e4d6'),
    hemiSky: 0x9edbff,
    hemiGround: 0x167884,
    dirIntensity: 2.8,
    ambientIntensity: 0.72
  },
  sunset: {
    label: 'Sun: Sunset',
    sunDir: new THREE.Vector3(0.45, 0.16, -0.88).normalize(),
    zenith: new THREE.Color('#1c3c6e'),
    midSky: new THREE.Color('#c86d68'),
    horizon: new THREE.Color('#ffbe78'),
    cloudLight: new THREE.Color('#ffe0ad'),
    cloudShadow: new THREE.Color('#5a4361'),
    sunColor: new THREE.Color('#ffd080'),
    fogColor: new THREE.Color('#f4ba8a'),
    waterDeep: new THREE.Color('#0c3e59'),
    waterShallow: new THREE.Color('#1d8a92'),
    waterSss: new THREE.Color('#42c5b8'),
    hemiSky: 0xffc694,
    hemiGround: 0x1a5366,
    dirIntensity: 2.5,
    ambientIntensity: 0.65
  },
  dusk: {
    label: 'Sun: Vice Dusk',
    sunDir: new THREE.Vector3(-0.34, 0.13, -0.93).normalize(),
    zenith: new THREE.Color('#161b48'),
    midSky: new THREE.Color('#7a3b7c'),
    horizon: new THREE.Color('#ff7ca8'),
    cloudLight: new THREE.Color('#ffadd0'),
    cloudShadow: new THREE.Color('#2c254a'),
    sunColor: new THREE.Color('#ff9ec4'),
    fogColor: new THREE.Color('#c76b9e'),
    waterDeep: new THREE.Color('#092948'),
    waterShallow: new THREE.Color('#17728f'),
    waterSss: new THREE.Color('#38d1e0'),
    hemiSky: 0xd98cff,
    hemiGround: 0x123e5c,
    dirIntensity: 1.9,
    ambientIntensity: 0.62
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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.03 + vec2(17.1, 31.7);
      a *= 0.50;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = clamp(dir.y, 0.0, 1.0);

    // Rich tropical sky gradient
    vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.28, y));
    col = mix(col, uZenith, smoothstep(0.22, 0.86, y));

    // Horizon atmospheric haze band
    float haze = pow(max(1.0 - y, 0.0001), 7.0);
    col = mix(col, uHorizon * 1.05, haze * 0.68);

    // Sun glow & crisp disc
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0001);
    float sunHalo = pow(sunDot, 10.0) * 0.34 + pow(sunDot, 90.0) * 0.72;
    float sunDisc = smoothstep(0.9986, 0.99945, sunDot);
    col += uSunColor * (sunHalo + sunDisc * 2.8);

    // Towering tropical cumulus cloud banks around horizon & mid-sky
    if (dir.y > -0.02) {
      float elev = max(dir.y, 0.025);
      // Project onto a gently curved dome so clouds look huge near the horizon
      vec2 cloudUV = dir.xz / (elev + 0.24) * 1.05;
      cloudUV += vec2(uTime * 0.0045, uTime * 0.002);

      float baseNoise = fbm(cloudUV * 1.15);
      float detail = fbm(cloudUV * 2.8 + vec2(4.2, -2.7));
      float wisps = fbm(cloudUV * 5.2 - vec2(uTime * 0.006, 1.3));

      // Emphasize big cumulus banks between 3 deg and 38 deg elevation (like screenshot)
      float band = smoothstep(0.0, 0.075, dir.y) * (1.0 - smoothstep(0.32, 0.74, dir.y));
      float highCloud = smoothstep(0.18, 0.55, dir.y) * 0.38;

      float density = baseNoise * 0.72 + detail * 0.28;
      float coverage = mix(0.42, 0.56, smoothstep(0.05, 0.5, dir.y));
      float cloudMask = smoothstep(coverage, coverage + 0.24, density) * (band + highCloud);
      cloudMask = clamp(cloudMask + smoothstep(0.62, 0.82, wisps) * band * 0.25, 0.0, 1.0);

      // Directional self-shadowing: sample slightly toward sun
      vec2 sunStep = normalize(uSunDir.xz + vec2(0.0001)) * 0.14;
      float litSample = fbm((cloudUV + sunStep) * 1.15) * 0.72 + fbm((cloudUV + sunStep) * 2.8 + vec2(4.2, -2.7)) * 0.28;
      float lighting = clamp(0.62 + (density - litSample) * 2.8 + smoothstep(0.04, 0.32, dir.y) * 0.25, 0.0, 1.0);
      // Silver lining near sun
      float silver = pow(sunDot, 8.0) * 0.45;

      vec3 cloudCol = mix(uCloudShadow, uCloudLight, lighting);
      cloudCol += uSunColor * silver;
      // Blend distant horizon clouds subtly into mist
      cloudCol = mix(uHorizon, cloudCol, smoothstep(0.01, 0.14, dir.y));

      col = mix(col, cloudCol, cloudMask * 0.94);
    }

    // Subtle below-horizon water bounce color
    if (dir.y < 0.0) {
      col = mix(uHorizon, uMidSky * 0.5, clamp(-dir.y * 5.0, 0.0, 1.0));
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkySystem(scene) {
  const skyGeo = new THREE.SphereGeometry(2900, 48, 32);
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

  // Lights synchronized with sky
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
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Seabirds gliding across the tropical sky
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

    // Keep shadow frustum centered around player boat
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
    color: 0xf4f7fa,
    roughness: 0.7,
    side: THREE.DoubleSide
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0x26313c,
    roughness: 0.8,
    side: THREE.DoubleSide
  });

  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9, 5), wingMat);
    body.rotation.x = Math.PI * 0.5;
    g.add(body);

    const leftWing = new THREE.Group();
    const lwInner = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.34), wingMat);
    lwInner.position.x = -0.42;
    const lwTip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.22), tipMat);
    lwTip.position.x = -0.95;
    leftWing.add(lwInner, lwTip);

    const rightWing = new THREE.Group();
    const rwInner = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.34), wingMat);
    rwInner.position.x = 0.42;
    const rwTip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.22), tipMat);
    rwTip.position.x = 0.95;
    rightWing.add(rwInner, rwTip);

    g.add(leftWing, rightWing);
    const scale = 0.8 + (i % 4) * 0.22;
    g.scale.setScalar(scale);

    birdGroup.add(g);
    birds.push({
      mesh: g,
      leftWing,
      rightWing,
      angle: (i / 16) * Math.PI * 2,
      radius: 55 + (i % 5) * 38,
      altitude: 18 + (i % 6) * 7,
      speed: 0.12 + (i % 4) * 0.045,
      flapSpeed: 4.5 + (i % 3) * 1.1,
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
        const cy = b.altitude + Math.sin(time * 0.9 + b.phase) * 2.4;

        b.mesh.position.set(cx, cy, cz);
        b.mesh.rotation.y = -a;
        const flap = Math.sin(time * b.flapSpeed + b.phase) * 0.45;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
      }
    }
  };
}
