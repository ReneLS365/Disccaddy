import * as THREE from "three";
import { Flight } from "../physics/engines.js";
import { palette } from "../ui/theme.js";
const D = Math.PI / 180;
export function createScene({
  $,
  getSettings,
  getPlotAim,
  sceneVector,
  compareColors,
  onContextLost,
}) {
  const colors = palette();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.bg);
  scene.fog = new THREE.Fog(colors.bg, 180, 650);
  const renderer = new THREE.WebGLRenderer({
    antialias: (devicePixelRatio || 1) < 1.5,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(
    Math.min(devicePixelRatio || 1, innerWidth <= 720 ? 1.5 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $("world").append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(49, 1, 0.1, 1400);
  const viewRotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0),
    position = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    heading = new THREE.Vector3(0, 0, -1),
    right = new THREE.Vector3(1, 0, 0),
    desired = new THREE.Vector3(),
    target = new THREE.Vector3(),
    smoothTarget = new THREE.Vector3(),
    center = new THREE.Vector3();
  let width = 1,
    height = 1,
    mode = "overview",
    radius = 40,
    fit = 120,
    needsSnap = true,
    pathObjects = [],
    trace = null,
    modelFlight = null;
  const hemi = new THREE.HemisphereLight(0xd9fff1, 0x18373d, 2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffebcf, 2.6);
  sun.position.set(-25, 45, 20);
  scene.add(sun);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ color: colors.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);
  const grid = new THREE.GridHelper(800, 80, colors.grid, colors.grid);
  grid.position.z = -200;
  scene.add(grid);
  const tee = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.03, 3),
    new THREE.MeshStandardMaterial({ color: 0x6b907b }),
  );
  tee.position.set(0, 0.01, 1.5);
  scene.add(tee);
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 64),
    new THREE.MeshBasicMaterial({
      color: colors.lime,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  scene.add(targetRing);
  const centerLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.025, 0),
      new THREE.Vector3(0, 0.025, -400),
    ]),
    new THREE.LineDashedMaterial({
      color: 0x8db3a1,
      dashSize: 1,
      gapSize: 1.3,
      transparent: true,
      opacity: 0.55,
    }),
  );
  centerLine.computeLineDistances();
  scene.add(centerLine);
  for (let distance = 25; distance <= 350; distance += 25) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.font = "500 30px system-ui";
    ctx.fillStyle = colors.muted;
    ctx.textAlign = "center";
    ctx.fillText(distance + " m", 128, 43);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    label.scale.set(7, 1.75, 1);
    label.position.set(-7.5, 0.9, -distance);
    label.userData.distance = distance;
    scene.add(label);
  }
  const disc = new THREE.Group(),
    spinner = new THREE.Group();
  disc.add(spinner);
  disc.scale.setScalar(3);
  scene.add(disc);
  const plastic = new THREE.MeshStandardMaterial({
    color: 0xc4f275,
    roughness: 0.45,
    metalness: 0.08,
    emissive: 0x18210b,
  });
  spinner.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.102, 0.018, 48),
      plastic,
    ),
  );
  const stamp = new THREE.Mesh(
    new THREE.RingGeometry(0.047, 0.057, 40),
    new THREE.MeshBasicMaterial({ color: 0x1c3b2c, side: THREE.DoubleSide }),
  );
  stamp.rotation.x = -Math.PI / 2;
  stamp.position.y = 0.0098;
  spinner.add(stamp);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.082, 0.001, 0.013),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  stripe.position.set(0.047, 0.01, 0);
  spinner.add(stripe);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({
      color: 0x020e13,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  scene.add(shadow);
  const windArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(6, 1, 0),
    6,
    0xffba76,
    1.3,
    0.7,
  );
  scene.add(windArrow);
  const phaseThree = {
    Turn: new THREE.Color(colors.cyan),
    Glide: new THREE.Color(colors.lime),
    Fade: new THREE.Color(colors.amber),
  };
  function clearPaths() {
    for (const object of pathObjects) {
      scene.remove(object);
      object.geometry.dispose();
      object.material.dispose();
    }
    pathObjects = [];
  }
  function addPath(object) {
    scene.add(object);
    pathObjects.push(object);
    return object;
  }
  function setFlights(list, selected) {
    clearPaths();
    const box = new THREE.Box3();
    targetRing.scale.setScalar(getSettings().targetRadius);
    targetRing.position.set(
      getSettings().targetLateral,
      0.07,
      -getSettings().targetDistance,
    );
    box.expandByPoint(
      new THREE.Vector3(
        getSettings().targetLateral - getSettings().targetRadius,
        0,
        -getSettings().targetDistance - getSettings().targetRadius,
      ),
    );
    box.expandByPoint(
      new THREE.Vector3(
        getSettings().targetLateral + getSettings().targetRadius,
        0,
        -getSettings().targetDistance + getSettings().targetRadius,
      ),
    );
    trace = null;
    modelFlight = list[selected];
    if (!modelFlight) return;
    list.forEach((f, i) => {
      const vertices = [],
        palette = [],
        projected = [];
      const comparisonColor = new THREE.Color(
        [colors.cyan, colors.lime, colors.amber][i % 3],
      );
      for (const sample of f.points) {
        const v = sceneVector(f, sample.p);
        vertices.push(...v);
        box.expandByPoint(new THREE.Vector3(...v));
        projected.push(v[0], 0.04, v[2]);
        palette.push(
          ...(list.length > 1
            ? comparisonColor
            : phaseThree[sample.phase]
          ).toArray(),
        );
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(palette, 3),
      );
      addPath(
        new THREE.Line(
          geometry.clone(),
          new THREE.LineBasicMaterial({
            color: list.length > 1 ? comparisonColor : colors.trace,
            transparent: true,
            opacity:
              document.documentElement.dataset.theme === "light"
                ? i === selected
                  ? 0.75
                  : 0.6
                : i === selected
                  ? 0.27
                  : 0.48,
          }),
        ),
      );
      if (i === selected) {
        trace = addPath(
          new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ vertexColors: true }),
          ),
        );
        trace.geometry.setDrawRange(0, 0);
      } else geometry.dispose();
      addPath(
        new THREE.Line(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(projected, 3),
          ),
          new THREE.LineBasicMaterial({
            color: list.length > 1 ? comparisonColor : colors.trace,
            transparent: true,
            opacity: 0.25,
          }),
        ),
      );
      const end = sceneVector(f, f.points.at(-1).p),
        ring = new THREE.Mesh(
          new THREE.RingGeometry(0.6, 0.82, 48),
          new THREE.MeshBasicMaterial({
            color: list.length > 1 ? comparisonColor : colors.lime,
            side: THREE.DoubleSide,
          }),
        );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(end[0], 0.05, end[2]);
      addPath(ring);
    });
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    center.copy(sphere.center);
    radius = Math.max(8, sphere.radius);
    plastic.color.set(modelFlight.p.discColor || 0xc4f275);
    disc.scale.setScalar(
      (3 * (modelFlight.coefficients?.diameter || 0.21)) / 0.21,
    );
    const wind = sceneVector(modelFlight, Flight.wind(modelFlight.p)),
      magnitude = Flight.len(wind);
    windArrow.visible = magnitude > 0.01;
    if (magnitude > 0.01) {
      windArrow.setDirection(new THREE.Vector3(...wind).normalize());
      windArrow.setLength(3 + magnitude * 0.3, 1, 0.6);
    }
    needsSnap = true;
    resize(width, height);
  }
  function setDisc(f, point, time) {
    position.fromArray(sceneVector(f, point.p));
    normal.fromArray(sceneVector(f, point.n));
    disc.position.copy(position);
    disc.position.y += 0.032;
    const landed = time >= f.duration;
    if (point.q && !landed) {
      disc.quaternion.fromArray(point.q);
      viewRotation.setFromAxisAngle(up, -(f.p.aim - getPlotAim()) * D);
      disc.quaternion.premultiply(viewRotation);
    } else disc.quaternion.setFromUnitVectors(up, landed ? up : normal);
    const omega = (f.p.rpm * 2 * Math.PI) / 60;
    spinner.rotation.y = point.q
      ? 0
      : (-Flight.spinSign(f.p.style) * omega * (1 - Math.exp(-0.04 * time))) /
        0.04;
    shadow.position.set(position.x, 0.022, position.z);
    shadow.scale.setScalar(1 + position.y * 0.035);
    shadow.material.opacity = 0.35 / (1 + position.y * 0.12);
    const velocity = sceneVector(f, point.v);
    heading.set(velocity[0], 0, velocity[2]).normalize();
    if (heading.lengthSq() < 0.1) heading.set(0, 0, -1);
    right.crossVectors(heading, up).normalize();
    if (trace)
      trace.geometry.setDrawRange(
        0,
        time === 0
          ? 0
          : landed
            ? f.points.length
            : Math.min(f.points.length, point.index + 2),
      );
    windArrow.position.set(
      position.x + 5,
      Math.max(0.9, position.y * 0.25),
      position.z + 3,
    );
  }
  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    const top = 16,
      bottom = 16,
      usableH = Math.max(40, height - top - bottom),
      usableW = Math.max(40, width - 32),
      centerY = top + usableH / 2;
    camera.setViewOffset(width, height, 0, height / 2 - centerY, width, height);
    const tan = Math.tan((camera.fov * D) / 2),
      angle = Math.atan(
        Math.max(
          0.035,
          Math.min(
            (tan * usableH) / height,
            (tan * camera.aspect * usableW) / width,
          ),
        ),
      );
    fit = (radius * 1.12) / Math.sin(angle);
    camera.far = Math.max(1400, fit + radius * 4);
    camera.updateProjectionMatrix();
  }
  function updateCamera(dt) {
    if (mode === "overview" || mode === "top") {
      target.copy(center);
      desired
        .copy(center)
        .add(
          new THREE.Vector3(
            0,
            mode === "top" ? 1 : 0.85,
            mode === "top" ? 0.001 : 1,
          )
            .normalize()
            .multiplyScalar(fit),
        );
      scene.fog.near = Math.max(180, fit * 1.25);
      scene.fog.far = Math.max(650, fit * 2.5);
    } else {
      target
        .copy(position)
        .addScaledVector(heading, mode === "follow" ? 1.5 : 0);
      desired
        .copy(position)
        .addScaledVector(heading, mode === "follow" ? -11 : 0)
        .addScaledVector(right, mode === "follow" ? 3.5 : 24);
      desired.y += mode === "follow" ? 5 : 9;
      scene.fog.near = 180;
      scene.fog.far = 650;
    }
    const moving =
      camera.position.distanceToSquared(desired) > 1e-5 ||
      smoothTarget.distanceToSquared(target) > 1e-5;
    const blend = needsSnap ? 1 : 1 - Math.exp(-7 * Math.min(dt, 0.15));
    camera.position.lerp(desired, blend);
    smoothTarget.lerp(target, blend);
    camera.lookAt(smoothTarget);
    needsSnap = false;
    return moving;
  }
  function setCamera(value) {
    mode = value;
    needsSnap = true;
  }
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  function setTheme() {
    Object.assign(colors, palette());
    const light = document.documentElement.dataset.theme === "light";
    hemi.intensity = light ? 1.4 : 2.4;
    sun.intensity = light ? 1.2 : 2.6;
    scene.background.set(colors.bg);
    scene.fog.color.set(colors.bg);
    ground.material.color.set(colors.ground);
    targetRing.material.color.set(colors.lime);
    windArrow.setColor(new THREE.Color(colors.amber));
    centerLine.material.color.set(colors.muted);
    scene.traverse((object) => {
      if (object.isSprite && object.userData.distance) {
        const texture = object.material.map,
          canvas = texture.image,
          context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = colors.muted;
          context.fillText(object.userData.distance + " m", 128, 43);
          texture.needsUpdate = true;
        }
      }
    });
    for (const [name, key] of [
      ["Turn", "cyan"],
      ["Glide", "lime"],
      ["Fade", "amber"],
    ])
      phaseThree[name].set(colors[key]);
    const attribute = grid.geometry.getAttribute("color"),
      color = new THREE.Color(colors.grid);
    for (let i = 0; i < attribute.count; i++)
      attribute.setXYZ(i, color.r, color.g, color.b);
    attribute.needsUpdate = true;
  }
  setTheme();
  return {
    setTheme,
    setFlights,
    setDisc,
    resize,
    updateCamera,
    setCamera,
    render: () => renderer.render(scene, camera),
  };
}
