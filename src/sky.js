import * as THREE from 'three';

export const TIME_PRESETS = {
  noon: {
    label: 'Sun: Noon',
    sunDir: new THREE.Vector3(0.32, 0.44, -0.84).normalize(),
    zenith: new THREE.Color('#104a8e'),
    midSky: new THREE.Color('#4793d0'),
    horizon: new THREE.Color('#d6eef5'),
    cloudLight: new THREE.Color('#ffffff'),
    cloudShadow: new THREE.Color('#6a829e'),
    sunColor: new THREE.Color('#fff9e8'),
    fogColor: new THREE.Color('#bfe2ec'),
    waterDeep: new THREE.Color('#07586f'),
    waterShallow: new THREE.Color('#19b4b8'),
    waterSss: new THREE.Color('#32e8d9'),
    hemiSky: 0xa6dfff,
    hemiGround: 0x16808a,
    dirIntensity: 2.9,
    ambientIntensity: 0.78
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
    ambientIntensity: 0.68
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
    ambientIntensity: 0.64
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

// True 2D Simplex noise — completely isotropic & smooth with zero square grid artifacts
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

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
      -0.577350269189626,
      0.024390243902439
    );
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g) * 0.5 + 0.5;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 6; i++) {
      v += a * snoise(p);
      p = rot * p * 2.04 + vec2(13.7, -9.3);
      a *= 0.49;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = clamp(dir.y, 0.0, 1.0);

    // Rich tropical sky gradient
    vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.28, y));
    col = mix(col, uZenith, smoothstep(0.22, 0.86, y));

    // Soft atmospheric horizon haze
    float haze = pow(max(1.0 - y, 0.0001), 6.5);
    col = mix(col, uHorizon * 1.04, haze * 0.72);

    // Blazing sun disc & smooth atmospheric corona
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0001);
    float sunGlowWide = pow(sunDot, 7.0) * 0.28;
    float sunGlowMid = pow(sunDot, 64.0) * 0.72;
    float sunDisc = smoothstep(0.9984, 0.99945, sunDot);
    col += uSunColor * (sunGlowWide + sunGlowMid + sunDisc * 3.0);

    // Billowy, organic cumulus cloud banks (zero grid artifacts)
    if (dir.y > -0.02) {
      float elev = max(dir.y, 0.03);
      vec2 cloudUV = dir.xz / (elev + 0.26) * 0.78;
      cloudUV += vec2(uTime * 0.0038, uTime * 0.0018);

      // Domain warp for fluffy billowing cumulus lobes
      vec2 warp = vec2(fbm(cloudUV * 1.2 + 2.1), fbm(cloudUV * 1.2 - 3.4));
      float base = fbm(cloudUV * 0.95 + warp * 0.35);
      float puffs = fbm(cloudUV * 2.2 - warp * 0.22);
      float density = base * 0.68 + puffs * 0.32;

      float band = smoothstep(0.0, 0.07, dir.y) * (1.0 - smoothstep(0.30, 0.76, dir.y));
      float highWisp = smoothstep(0.18, 0.58, dir.y) * 0.35;
      float threshold = mix(0.45, 0.58, smoothstep(0.05, 0.52, dir.y));
      float cloudMask = smoothstep(threshold, threshold + 0.22, density) * (band + highWisp);
      cloudMask = clamp(cloudMask, 0.0, 1.0);

      // Multi-sample directional sunlight & dark puffy cloud underbelly
      vec2 sunStep = normalize(uSunDir.xz + vec2(0.0001)) * 0.14;
      float dSun = fbm((cloudUV + sunStep) * 0.95 + warp * 0.35) * 0.68 +
                   fbm((cloudUV + sunStep) * 2.2 - warp * 0.22) * 0.32;
      float selfShadow = clamp(0.58 + (density - dSun) * 3.2 + smoothstep(0.04, 0.34, dir.y) * 0.28, 0.0, 1.0);
      float silverLining = pow(sunDot, 10.0) * 0.42 * (1.0 - cloudMask * 0.45);

      vec3 cloudCol = mix(uCloudShadow, uCloudLight, selfShadow);
      cloudCol += uSunColor * silverLining;
      cloudCol = mix(uHorizon, cloudCol, smoothstep(0.01, 0.14, dir.y));

      col = mix(col, cloudCol, cloudMask * 0.95);
    }

    if (dir.y < 0.0) {
      col = mix(uHorizon, uMidSky * 0.5, clamp(-dir.y * 5.0, 0.0, 1.0));
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkySystem(scene) {
  const skyGeo = new THREE.SphereGeometry(2900, 64, 40);
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
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Smooth soaring seabirds
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

  // Curved gull wing shape instead of rectangular box
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

  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, wingMat);
    g.add(body);

    const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
    const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
    g.add(leftWing, rightWing);

    const scale = 0.85 + (i % 4) * 0.22;
    g.scale.setScalar(scale);

    birdGroup.add(g);
    birds.push({
      mesh: g,
      leftWing,
      rightWing,
      angle: (i / 14) * Math.PI * 2,
      radius: 58 + (i % 5) * 40,
      altitude: 19 + (i % 6) * 7,
      speed: 0.11 + (i % 4) * 0.04,
      flapSpeed: 4.2 + (i % 3) * 0.9,
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
