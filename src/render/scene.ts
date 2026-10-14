import { SnapshotMotion } from "./snapshot-motion";
import { observedAnimalSpeed } from "./motion";
import { RenderAssets } from "./assets";
import { RigActors } from "./rigs";
import { DetailedWorldModels } from "./world-models";
import { modelYaw, characterYaw } from "./facing";
import { WorldLabels } from "./effects";
import { createMeadow } from "./meadow";
import type { InstancedMesh } from "three";
import {
  Scene,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Fog,
  Mesh,
  Object3D,
  MeshBasicMaterial,
  BoxGeometry,
  SphereGeometry,
  Color,
  Vector3,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  Frustum,
  Matrix4,
  Sphere,
} from "three";
import type {
  PlayerView,
  Entity,
  InputFrame,
  Building,
  Vec3,
} from "../game/types";
import { BUILDINGS } from "../game/balance";
import { ModelLibrary } from "./models";
import { ModelBatches } from "./batches";
import { FollowCamera, cameraSubject } from "./camera";
import { createTerrain } from "./terrain";
export class GameScene {
  menu = true;
  readonly scene = new Scene();
  readonly follow = new FollowCamera();
  canvas!: HTMLCanvasElement;
  private renderer?: WebGLRenderer;
  private models = new ModelLibrary();
  private assets = new RenderAssets();
  private rigs?: RigActors;
  private detailed?: DetailedWorldModels;
  private ready = false;
  private disposed = false;
  private pendingView?: PlayerView;
  private batches = new ModelBatches(this.scene);
  private terrain?: Mesh;
  private meadow?: InstancedMesh;
  private labels?: WorldLabels;
  private updatedAt = performance.now();
  private root = new Object3D();
  private view?: PlayerView;
  private resize?: ResizeObserver;
  private raf = 0;
  private time = performance.now();
  private sun?: DirectionalLight;
  private animalSpeeds = new Map<number, number>();
  private motion = new SnapshotMotion();
  private entities = new Map<number, Entity>();
  private colors = new Map<number, string>();
  private telemetryAt = 0;
  private wasMenu = true;
  private shotGeo = new SphereGeometry(0.055, 5, 4);
  private shotMat = new MeshBasicMaterial({ color: "#e1cf94" });
  private shots: Mesh[] = [];
  private preview = new Mesh(
    new BoxGeometry(1, 0.25, 1),
    new MeshBasicMaterial({
      color: "#b9d096",
      transparent: true,
      opacity: 0.55,
    }),
  );
  private placing?: Building;
  private placePos?: Vec3;
  private frames: number[] = [];
  private frustum = new Frustum();
  private projection = new Matrix4();
  private sphere = new Sphere();
  private validPlacement = false;
  constructor(
    private host: HTMLElement,
    private input?: () => InputFrame,
    private predicted?: () => Vec3 | undefined,
  ) {}
  async mount(): Promise<void> {
    this.renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute(
      "aria-label",
      "Hearthguard third-person battlefield",
    );
    this.canvas.style.touchAction = "none";
    this.host.appendChild(this.canvas);
    this.labels = new WorldLabels(this.host);
    this.renderer.setPixelRatio(
      matchMedia("(pointer:coarse)").matches
        ? 1
        : Math.min(devicePixelRatio, 1.5),
    );
    this.renderer.shadowMap.enabled = !matchMedia("(pointer:coarse)").matches;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene.background = new Color("#b7c8c3");
    this.scene.fog = new Fog("#b7c8c3", 42, 115);
    this.scene.add(new HemisphereLight("#f4e9cf", "#4e624d", 2.4));
    this.sun = new DirectionalLight("#ffefd0", 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -24,
      right: 24,
      top: 24,
      bottom: -24,
      near: 0.5,
      far: 130,
    });
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun, this.sun.target, this.preview);
    this.preview.visible = false;
    this.resize = new ResizeObserver(() => {
      const w = this.host.clientWidth,
        h = this.host.clientHeight;
      this.renderer!.setSize(w, h);
      this.follow.resize(w, h);
    });
    this.resize.observe(this.host);
    await this.assets.load();
    if (this.disposed) return;
    this.rigs = new RigActors(this.scene, this.assets.models);
    this.detailed = new DetailedWorldModels(
      this.assets.models,
      this.assets.textures,
    );
    this.ready = true;
    if (this.pendingView) this.update(this.pendingView);
    this.time = performance.now();
    this.loop();
  }
  update(view: PlayerView): void {
    if (!this.ready) {
      this.pendingView = view;
      return;
    }
    if (
      !this.view ||
      view.tick < this.view.tick ||
      view.size !== this.view.size ||
      view.config.seed !== this.view.config.seed
    ) {
      this.rigs?.dispose();
      this.rigs = new RigActors(this.scene, this.assets.models);
      if (this.terrain) {
        this.scene.remove(this.terrain);
        this.terrain.geometry.dispose();
        (this.terrain.material as MeshBasicMaterial).dispose();
      }
      if (this.meadow) {
        this.scene.remove(this.meadow);
        this.meadow.geometry.dispose();
        (this.meadow.material as MeshBasicMaterial).dispose();
      }
      this.meadow = createMeadow(view);
      this.scene.add(this.meadow);
      this.terrain = createTerrain(view, this.assets.textures);
      this.terrain.receiveShadow = true;
      this.scene.add(this.terrain);
      this.motion.clear();
      this.follow.reset();
      this.animalSpeeds.clear();
    }
    if (
      this.view &&
      this.view.config.seed === view.config.seed &&
      this.view.size === view.size &&
      view.tick > this.view.tick
    ) {
      const prior = new Map(this.view.entities.map((e) => [e.id, e]));
      for (const e of view.entities) {
        if ((e.type === "deer" || e.type === "horse") && !e.ghost) {
          const old = prior.get(e.id);
          this.animalSpeeds.set(
            e.id,
            observedAnimalSpeed(
              old?.type === e.type ? old.pos : undefined,
              e.pos,
              (view.tick - this.view.tick) / 30,
            ),
          );
        }
      }
    }
    const now = performance.now();
    const interval =
      this.view && !view.paused
        ? Math.max(0, (view.tick - this.view.tick) / 30)
        : 0;
    this.motion.push(
      [
        ...view.players.map((p) => ({
          id: p.id,
          pos: p.pos,
          yaw: p.yaw,
          snap:
            this.view?.players.find((old) => old.id === p.id)?.dead !== p.dead,
        })),
        ...view.entities
          .filter(
            (e) => !e.ghost && ["deer", "horse", "catapult"].includes(e.type),
          )
          .map((e) => ({ id: e.id, pos: e.pos, yaw: e.yaw })),
      ],
      now,
      interval,
    );
    this.entities = new Map(view.entities.map((e) => [e.id, e]));
    this.colors = new Map(view.factions.map((f) => [f.id, f.color]));
    this.view = view;
    this.updatedAt = now;
  }
  setPlacement(type?: Building): void {
    this.placing = type;
  }
  setQuality(quality: "auto" | "light" | "detailed"): void {
    if (!this.renderer) return;
    const gl = this.renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : "";
    const light =
      quality === "light" ||
      (quality === "auto" &&
        (matchMedia("(pointer:coarse)").matches ||
          /Intel|SwiftShader|llvmpipe/i.test(gpu)));
    this.renderer.setPixelRatio(
      light
        ? matchMedia("(pointer:coarse)").matches
          ? 1
          : 0.85
        : Math.min(devicePixelRatio, 1.5),
    );
    this.renderer.shadowMap.enabled = !light;
  }
  placementValid(): boolean {
    return this.validPlacement;
  }
  placementPosition(): Vec3 | undefined {
    return this.placePos;
  }
  nearest(): Entity | undefined {
    const v = this.view,
      p = v?.players.find((p) => p.id === v.playerId);
    if (!v || !p) return;
    const i = this.input?.() ?? p.input,
      dir = { x: Math.sin(i.yaw), z: -Math.cos(i.yaw) };
    return v.entities
      .filter(
        (e) =>
          !e.ghost &&
          e.hp > 0 &&
          (!["tree", "stone", "ore", "deer"].includes(e.type) ||
            e.amount > 0) &&
          (e.faction === p.faction || e.faction < 0 || e.type === "trap") &&
          Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <
            (BUILDINGS[e.type as Building]?.size ?? 1) / 2 + 3,
      )
      .map((e) => {
        const dx = e.pos.x - p.pos.x,
          dz = e.pos.z - p.pos.z,
          d = Math.hypot(dx, dz),
          dot = (dx * dir.x + dz * dir.z) / Math.max(0.1, d);
        return { e, score: d - dot * 4 };
      })
      .sort((a, b) => a.score - b.score)[0]?.e;
  }
  aimOrigin(): Vec3 | undefined {
    if (!this.ready || this.menu) return;
    const pos = this.follow.camera.position;
    return { x: pos.x, y: pos.y, z: pos.z };
  }
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.renderer || !this.view) return;
    const now = performance.now();
    if (this.menu !== this.wasMenu) {
      this.frames = [];
      this.time = now;
      this.wasMenu = this.menu;
    }
    if (this.menu && now - this.time < 50) return;
    const dt = Math.min(0.08, (now - this.time) / 1000);
    this.frames.push(now - this.time);
    if (this.frames.length > 120) this.frames.shift();
    this.time = now;

    const v = this.view,
      self = v.players.find((p) => p.id === v.playerId) ?? v.players[0];
    if (!self) return;
    const predicted = this.predicted?.();
    const p = cameraSubject(v, predicted);
    if (!predicted || p.id !== v.playerId)
      p.pos = this.motion.sample(p.id, now)?.pos ?? p.pos;
    const input = this.input?.() ?? p.input;
    this.follow.distanceOverride = this.menu ? 11 : undefined;
    this.follow.update({ ...p, input }, v, input.yaw, input.pitch, dt);
    if (this.sun) {
      this.sun.position.set(p.pos.x - 18, p.pos.y + 38, p.pos.z + 15);
      this.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);
    }
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(
        this.follow.camera.projectionMatrix,
        this.follow.camera.matrixWorldInverse,
      ),
    );
    this.batches.begin();
    this.rigs?.begin();
    const draw = (
      id: number,
      type: string,
      color: string,
      pos: Vec3,
      yaw: number,
      scale: number,
      moving: boolean,
      working: boolean,
      attacking: boolean,
      tint = 0xffffff,
    ) => {
      this.root.position.set(pos.x, pos.y, pos.z);
      const gate = this.entities.get(id);
      const gateOpen =
        type === "gate" &&
        !gate?.gateLocked &&
        v.players.some(
          (actor) =>
            !actor.dead &&
            actor.faction === gate?.faction &&
            Math.hypot(actor.pos.x - pos.x, actor.pos.z - pos.z) < 5,
        );
      this.root.rotation.set(0, modelYaw(yaw), 0);
      this.root.scale.set(1, scale, 1);
      this.root.updateMatrix();
      for (const part of this.detailed?.get(type, color) ??
        this.models.get(type, color))
        this.batches.add(
          part,
          this.root.matrix,
          tint,
          now * 0.01 + id,
          moving ? 1 : 0,
          working,
          attacking,
          gateOpen,
          id,
        );
    };
    for (const e of v.entities) {
      const bounds = BUILDINGS[e.type as Building];
      const height = bounds?.height ?? (e.type === "tree" ? 6 : 2);
      this.sphere.center.set(e.pos.x, e.pos.y + height / 2, e.pos.z);
      this.sphere.radius = Math.hypot(bounds?.size ?? 4, height) / 1.4;
      if (
        Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > 65 ||
        !this.frustum.intersectsSphere(this.sphere)
      )
        continue;
      if (["tree", "stone", "ore", "deer"].includes(e.type) && e.amount <= 0)
        continue;
      const color = this.colors.get(e.faction) ?? "#78adba";
      const pose = this.motion.sample(e.id, now);
      if (e.type === "deer" || e.type === "horse") {
        if (e.ghost) continue;
        this.rigs?.animal(e, {
          pos:
            e.occupant === v.playerId && predicted
              ? predicted
              : (pose?.pos ?? e.pos),
          yaw: pose?.yaw ?? e.yaw,
          dt,
          tick: v.tick,
          speed:
            e.type === "deer"
              ? (this.animalSpeeds.get(e.id) ?? 0)
              : (e.speed ?? 0),
          paused: v.paused,
        });
        continue;
      }
      draw(
        e.id,
        e.type,
        color,
        pose?.pos ?? e.pos,
        pose?.yaw ?? e.yaw,
        e.hp <= 0 ? 0.12 : Math.max(0.08, e.progress),
        false,
        false,
        false,
        e.ghost ? 0x8b9685 : 0xffffff,
      );
    }
    for (const actor of v.players) {
      const color = this.colors.get(actor.faction) ?? "#73b4c6";
      const local = actor.id === v.playerId;
      const pose = this.motion.sample(actor.id, now);
      const pos = local && predicted ? predicted : (pose?.pos ?? actor.pos);
      if (!local) {
        this.sphere.center.set(pos.x, pos.y + 1, pos.z);
        this.sphere.radius = 2.5;
        if (
          Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) > 65 ||
          !this.frustum.intersectsSphere(this.sphere)
        )
          continue;
      }
      const owned = this.entities.get(actor.vehicleId ?? -1);
      const vehiclePose = owned && this.motion.sample(owned.id, now);
      const vehicle =
        owned?.occupant === actor.id
          ? { ...owned, yaw: vehiclePose?.yaw ?? owned.yaw }
          : undefined;
      this.rigs?.actor(actor, {
        pos: { ...pos, y: pos.y + (vehicle?.type === "horse" ? 1 : 0) },
        yaw: characterYaw(
          actor.id,
          v.playerId,
          input.yaw,
          pose?.yaw ?? actor.yaw,
        ),
        pitch: local ? input.pitch : actor.pitch,
        aim: local ? input.aim : actor.input.aim,
        color,
        dt,
        tick: v.tick,
        paused: v.paused,
        input: local ? input : actor.input,
        workingTarget: this.entities.get(actor.action?.target ?? -1) ?? vehicle,
      });
    }
    this.rigs?.end();
    this.batches.end();
    for (let i = 0; i < v.projectiles.length; i++) {
      let m = this.shots[i];
      if (!m) {
        m = new Mesh(this.shotGeo, this.shotMat);
        this.shots.push(m);
        this.scene.add(m);
      }
      const shot = v.projectiles[i];
      m.visible = true;
      const age = Math.min(0.09, (now - this.updatedAt) / 1000);
      m.position.set(
        shot.pos.x + shot.vel.x * age,
        shot.pos.y + shot.vel.y * age,
        shot.pos.z + shot.vel.z * age,
      );
      m.scale.setScalar(shot.kind === "catapult" ? 5 : 1);
    }
    for (let i = v.projectiles.length; i < this.shots.length; i++)
      this.shots[i].visible = false;
    this.preview.visible = !!this.placing && !p.dead;
    if (this.placing) {
      const d = BUILDINGS[this.placing],
        x = p.pos.x + Math.sin(input.yaw) * 7,
        z = p.pos.z - Math.cos(input.yaw) * 7;
      const xx = Math.round(x),
        zz = Math.round(z),
        height =
          v.heights[
            Math.max(0, Math.min(v.size, zz)) * (v.size + 1) +
              Math.max(0, Math.min(v.size, xx))
          ] ?? p.pos.y;
      this.placePos = { x: xx, y: height, z: zz };
      this.preview.position.set(xx, height + 0.2, zz);
      this.preview.scale.set(d.size, 1, d.size);
      const bank = v.factions.find((f) => f.id === p.faction)!.stock;
      this.validPlacement =
        xx > d.size &&
        zz > d.size &&
        xx < v.size - d.size &&
        zz < v.size - d.size &&
        Object.entries(d.cost).every(
          ([k, n]) => bank[k as keyof typeof bank] >= n!,
        ) &&
        !d.requires?.some(
          (t) =>
            !v.entities.some(
              (e) =>
                e.faction === p.faction &&
                e.type === t &&
                e.progress === 1 &&
                e.hp > 0,
            ),
        ) &&
        !v.entities.some((e) => {
          if (e.hp <= 0) return false;
          const b = BUILDINGS[e.type as Building];
          return b
            ? Math.abs(xx - e.pos.x) < (b.size + d.size) / 2 + 0.3 &&
                Math.abs(zz - e.pos.z) < (b.size + d.size) / 2 + 0.3
            : ["tree", "stone", "ore"].includes(e.type) &&
                e.amount > 0 &&
                Math.abs(xx - e.pos.x) < d.size / 2 + 0.6 &&
                Math.abs(zz - e.pos.z) < d.size / 2 + 0.6;
        });
      this.preview.material.color.set(
        this.validPlacement ? "#b9d096" : "#d47c62",
      );
    }
    this.renderer.render(this.scene, this.follow.camera);
    if (now - this.telemetryAt >= 250) {
      this.telemetryAt = now;
      const rigs = this.rigs?.metrics();
      this.canvas.dataset.fps = String(this.metrics().fps);
      this.canvas.dataset.drawCalls = String(this.renderer.info.render.calls);
      this.canvas.dataset.triangles = String(
        this.renderer.info.render.triangles,
      );
      this.canvas.dataset.riggedCharacters = String(rigs?.characters ?? 0);
      this.canvas.dataset.rigBones = String(rigs?.bones ?? 0);
      this.canvas.dataset.facing = String(input.yaw);
      this.canvas.dataset.characterHeading = String(
        this.rigs?.heading(v.playerId) ?? 0,
      );
    }
    if (this.menu) this.labels?.clear();
    else
      this.labels?.draw(
        v,
        this.follow,
        this.host.clientWidth,
        this.host.clientHeight,
      );
  };
  metrics(): { fps: number; drawCalls: number } {
    return {
      fps:
        1000 /
        (this.frames.reduce((a, b) => a + b, 0) /
          Math.max(1, this.frames.length)),
      drawCalls: this.renderer?.info.render.calls ?? 0,
    };
  }
  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.rigs?.dispose();
    this.detailed?.dispose();
    this.assets.dispose();
    this.resize?.disconnect();
    this.batches.dispose();
    this.models.dispose();
    this.terrain?.geometry.dispose();
    (this.terrain?.material as MeshBasicMaterial)?.dispose();
    this.shotGeo.dispose();
    this.shotMat.dispose();
    this.preview.geometry.dispose();
    this.preview.material.dispose();
    this.sun?.shadow.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();
    this.labels?.dispose();
    this.meadow?.geometry.dispose();
    (this.meadow?.material as MeshBasicMaterial)?.dispose();
  }
}
