import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DebugScene } from '../../external/pbrt/web/src/renderer/debug-scene';
import type { Capture } from '../components/PathView';

// A diagnostic raster view of the same packed geometry, not another light integrator.
export class PathSceneView {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private meshes: T.Mesh[] = [];
  private points: T.Mesh[] = [];
  private nee = new T.Group();
  private ghosts = new T.Group();
  private radius: number;
  private alive = true;
  private unbind: () => void;
  constructor(
    host: HTMLElement,
    data: DebugScene,
    capture: Capture,
    select: (index: number) => void,
  ) {
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor('#11171b');
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', '场景中的三维采样路径');
    canvas.tabIndex = 0;
    host.append(canvas);
    const min = new T.Vector3().fromArray(data.bounds.min),
      max = new T.Vector3().fromArray(data.bounds.max);
    const center = min.clone().add(max).multiplyScalar(0.5);
    this.radius = Math.max(0.01, min.distanceTo(max) * 0.5);
    this.camera = new T.PerspectiveCamera(
      capture.fov ?? 45,
      1,
      this.radius * 0.001,
      this.radius * 200,
    );
    const m = capture.camera,
      eye = new T.Vector3(m[3], m[7], m[11]);
    const forward = new T.Vector3(m[2], m[6], m[10]).normalize();
    this.camera.position.copy(eye);
    this.camera.up.set(m[1], m[5], m[9]).normalize();
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target
      .copy(eye)
      .addScaledVector(forward, Math.max(this.radius, eye.distanceTo(center)));
    this.controls.minDistance = this.radius * 0.025;
    this.controls.maxDistance = this.radius * 50;
    this.controls.update();
    // Rendering only on interaction/resize/selection leaves the path tracer untouched.
    this.controls.addEventListener('change', this.draw);
    this.controls.saveState();
    for (const mesh of data.meshes) {
      const positions = mesh.positions.slice();
      const bounds = new T.Box3().setFromArray(positions);
      const size = bounds.getSize(new T.Vector3());
      // PBRT surfaces may be two-sided or wound away from the room interior.
      // For the diagnostic cutaway only, orient planar enclosure faces inward.
      // Box surfaces remain double-sided; traced geometry/normals are never edited.
      const enclosure = ['x', 'y', 'z'].some((axis, i) => {
        const key = axis as 'x' | 'y' | 'z';
        return (
          size[key] < this.radius * 1e-5 &&
          (Math.abs(bounds.min[key] - min.getComponent(i)) < this.radius * 1e-5 ||
            Math.abs(bounds.max[key] - max.getComponent(i)) < this.radius * 1e-5)
        );
      });
      if (enclosure)
        for (let i = 0; i < positions.length; i += 9) {
          const a = new T.Vector3().fromArray(positions, i);
          const b = new T.Vector3().fromArray(positions, i + 3);
          const c = new T.Vector3().fromArray(positions, i + 6);
          const normal = b.clone().sub(a).cross(c.clone().sub(a));
          if (normal.dot(center.clone().sub(a)) < 0) {
            positions.set(c.toArray(), i + 3);
            positions.set(b.toArray(), i + 6);
          }
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const emitting = mesh.emission.some((v) => v > 0);
      const material = new T.MeshLambertMaterial({
        color: emitting ? '#e5dfba' : new T.Color(...mesh.color),
        emissive: emitting ? '#77715a' : '#000000',
        side: enclosure ? T.FrontSide : T.DoubleSide,
      });
      const object = new T.Mesh(geometry, material);
      object.userData.placement = mesh.placement;
      object.userData.enclosure = enclosure;
      this.meshes.push(object);
      this.scene.add(object);
    }
    this.scene.add(new T.HemisphereLight('#ffffff', '#828b96', 1.0));
    const light = new T.DirectionalLight('#ffffff', 0.6);
    light.position.copy(eye);
    this.scene.add(light);
    this.scene.add(this.nee, this.ghosts);
    const positions = [eye, ...capture.vertices.map((v) => new T.Vector3().fromArray(v))];
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1],
        b = positions[i],
        delta = b.clone().sub(a);
      const length = delta.length();
      if (length > 1e-8) {
        const tube = new T.Mesh(
          new T.CylinderGeometry(this.radius * 0.004, this.radius * 0.004, length, 8),
          new T.MeshBasicMaterial({ color: '#18a56d' }),
        );
        tube.position.copy(a).add(b).multiplyScalar(0.5);
        tube.quaternion.setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          delta.clone().normalize(),
        );
        this.scene.add(tube);
        const cone = new T.Mesh(
          new T.ConeGeometry(this.radius * 0.013, this.radius * 0.045, 8),
          new T.MeshBasicMaterial({ color: '#18a56d' }),
        );
        cone.position.copy(a).lerp(b, 0.7);
        cone.quaternion.copy(tube.quaternion);
        this.scene.add(cone);
      }
      const ghost = new T.Line(
        new T.BufferGeometry().setFromPoints([a, b]),
        new T.LineDashedMaterial({
          color: '#83bca1',
          depthTest: false,
          transparent: true,
          opacity: 0.45,
          dashSize: this.radius * 0.025,
          gapSize: this.radius * 0.015,
        }),
      );
      ghost.computeLineDistances();
      this.ghosts.add(ghost);
      const sphere = new T.Mesh(
        new T.SphereGeometry(this.radius * 0.018, 12, 8),
        new T.MeshBasicMaterial({ color: '#18a56d', depthTest: false }),
      );
      sphere.position.copy(b);
      sphere.userData.vertex = i - 1;
      sphere.renderOrder = 10;
      this.points.push(sphere);
      this.scene.add(sphere);
      const vertex = capture.vertices[i - 1];
      if (vertex[31] > 0) {
        const endpoint = new T.Vector3().fromArray(vertex, 40);
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints([b, endpoint]),
          new T.LineDashedMaterial({
            color: vertex[43] > 0 ? '#f6ca6a' : '#cf7775',
            depthTest: false,
            transparent: true,
            opacity: 0.7,
            dashSize: this.radius * 0.035,
            gapSize: this.radius * 0.02,
          }),
        );
        line.computeLineDistances();
        this.nee.add(line);
      }
    }
    const marker = new T.Mesh(
      new T.SphereGeometry(this.radius * 0.025, 12, 8),
      new T.MeshBasicMaterial({ color: '#85b9ff' }),
    );
    marker.position.copy(eye);
    this.scene.add(marker);
    const clickStart = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      clickStart.x = e.clientX;
      clickStart.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        Math.hypot(e.clientX - clickStart.x, e.clientY - clickStart.y) > 4
      )
        return;
      const rect = canvas.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((e.clientY - rect.top) / rect.height) * 2,
        ),
        this.camera,
      );
      const hit = ray.intersectObjects(this.points)[0];
      if (hit) select(hit.object.userData.vertex);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    this.unbind = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
    };
    this.observer = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      if (!width || !height || !this.alive) return;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.draw();
    });
    this.observer.observe(host);
    this.select(0);
  }
  private draw = () => {
    if (this.alive) this.renderer.render(this.scene, this.camera);
  };
  select(index: number) {
    this.points.forEach((p, i) => {
      (p.material as T.MeshBasicMaterial).color.set(i === index ? '#f3b64a' : '#18a56d');
      p.scale.setScalar(i === index ? 1.5 : 1);
    });
    this.draw();
  }
  options(cutaway: boolean, nee: boolean, xray: boolean) {
    for (const mesh of this.meshes) {
      const material = mesh.material as T.Material;
      material.side = cutaway && mesh.userData.enclosure ? T.FrontSide : T.DoubleSide;
      material.needsUpdate = true;
    }
    this.nee.visible = nee;
    this.ghosts.visible = xray;
    this.draw();
  }
  reset() {
    this.controls.reset();
  }
  fit() {
    const box = new T.Box3();
    this.meshes.forEach((mesh) => box.expandByObject(mesh));
    const center = box.getCenter(new T.Vector3());
    const halfFov = Math.atan(
      Math.tan(T.MathUtils.degToRad(this.camera.fov) / 2) *
        Math.min(1, this.camera.aspect),
    );
    const distance = (this.radius / Math.sin(halfFov)) * 1.12;
    this.camera.position
      .copy(center)
      .add(new T.Vector3(1.3, 0.9, 1.7).normalize().multiplyScalar(distance));
    this.controls.target.copy(center);
    this.controls.update();
  }
  focus(index: number) {
    if (!this.points[index]) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(this.points[index].position);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  dispose() {
    this.alive = false;
    this.observer.disconnect();
    this.unbind();
    this.controls.dispose();
    this.scene.traverse((object) => {
      const obj = object as T.Mesh;
      obj.geometry?.dispose();
      if (obj.material)
        for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material])
          mat.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
