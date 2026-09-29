// PEKL 3D-flesje: glas, augurkensap, groene dop en het etiket als textuur.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { drawLabel, loadLabelFonts } from "./label.js";

const R = 1;                        // straal van het flesje (≈ 18,8 mm)
const LABEL_H = (2 * Math.PI * R) / 2.03; // etiket 118 × 58 mm
const BODY_TOP = 3.4;

export async function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 6, 8);
  const rim = new THREE.DirectionalLight(0xfff1dc, 1.2);
  rim.position.set(6, 2, -6);
  const rim2 = new THREE.DirectionalLight(0xffffff, 1.2);
  rim2.position.set(-6, -2, -5);
  scene.add(key, rim, rim2, new THREE.AmbientLight(0xffffff, 0.25));

  // Hiërarchie: rig (positie, schaal) → tilt (kantelen) → spin (om eigen as)
  const rig = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  rig.add(tilt);
  tilt.add(spin);
  scene.add(rig);

  const bottle = new THREE.Group();
  bottle.position.y = -2.5; // draaipunt in het midden van de fles
  spin.add(bottle);

  // Glas
  const glassProfile = [
    [0, 0], [0.86, 0], [0.97, 0.03], [1.0, 0.14], [1.0, BODY_TOP],
    [0.97, 3.62], [0.86, 3.82], [0.64, 3.97], [0.5, 4.05], [0.47, 4.12], [0.47, 4.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(glassProfile, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.16,
      envMapIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  glass.renderOrder = 2;

  // Augurkensap (troebel geelgroen), iets binnen het glas
  const juiceProfile = [
    [0, 0.05], [0.9, 0.05], [0.94, 0.14], [0.94, BODY_TOP], [0.9, 3.62], [0.78, 3.76], [0, 3.76],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const juice = new THREE.Mesh(
    new THREE.LatheGeometry(juiceProfile, 64),
    new THREE.MeshStandardMaterial({ color: 0xd2cf86, roughness: 0.35, transparent: true, opacity: 0.94 })
  );
  juice.renderOrder = 1;

  // Dop met ribbels (lathe) en afgeronde bovenkant
  const capProfile = [
    [0, 5.02], [0.44, 5.02], [0.54, 4.98], [0.57, 4.9], [0.57, 4.22], [0.55, 4.18], [0.49, 4.18],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const capGeo = new THREE.LatheGeometry(capProfile, 120);
  // ribbels: kleine radiale golf op de zijkant
  const pos = capGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 4.25 && y < 4.88) {
      const x = pos.getX(i), z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const f = 1 + Math.sin(a * 48) * 0.012;
      pos.setX(i, x * f);
      pos.setZ(i, z * f);
    }
  }
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x264d33, roughness: 0.42, metalness: 0.05 }));

  // Etiket
  await loadLabelFonts();
  const labelCanvas = drawLabel(document.createElement("canvas"));
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.012, R * 1.012, LABEL_H, 128, 1, true, -Math.PI, Math.PI * 2),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.62, metalness: 0, envMapIntensity: 0.35 })
  );
  label.position.y = 0.22 + LABEL_H / 2;

  bottle.add(juice, label, cap, glass);

  // Wereld-eenheden van het zichtbare vlak op z = 0
  const view = { w: 1, h: 1 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, w < 760 ? 1.75 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    view.w = view.h * camera.aspect;
  }
  resize();
  window.addEventListener("resize", resize);

  // Pas een toestand toe: x/y als fractie van het scherm, s = schaal t.o.v. schermhoogte
  function apply(s) {
    rig.position.set(s.x * view.w, s.y * view.h, 0);
    const scale = (s.s * view.h) / 8.6;
    rig.scale.setScalar(scale);
    tilt.rotation.set(s.rx, 0, s.rz);
    spin.rotation.y = s.ry;
  }

  return {
    apply,
    render: () => renderer.render(scene, camera),
  };
}
