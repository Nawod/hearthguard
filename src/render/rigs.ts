import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LoopOnce,
  LoopRepeat,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Scene,
  Shape,
  ShapeGeometry,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { Entity, InputFrame, Player, Vec3, Weapon } from "../game/types";

interface ActorOptions {
  pos: Vec3;
  yaw: number;
  pitch: number;
  aim: boolean;
  color: string;
  dt: number;
  tick: number;
  paused?: boolean;
  workingTarget?: Entity;
  input?: InputFrame;
}
interface AnimalOptions {
  pos: Vec3;
  yaw: number;
  dt: number;
  tick: number;
  speed: number;
  paused?: boolean;
}
interface Rig {
  root: Group;
  model: Object3D;
  mixer: AnimationMixer;
  bones: Map<string, Bone>;
  actions: Map<string, AnimationAction>;
  active?: AnimationAction;
  clip: string;
  seen: boolean;
  lastSeen: number;
  dead: boolean;
  deathTime: number;
  hp: number;
  cooldown: number;
  heal: number;
  transient: boolean;
  strideYaw: number;
  fading: Map<AnimationAction, number>;
  gear: Map<string, Group>;
  armor: Mesh[];
  team: MeshStandardMaterial;
  outfit: string;
  bind: Map<string, Quaternion>;
  canonicalSkeletons: Map<string, Skeleton>;
  materials: Set<Material>;
  geometries: Set<BufferGeometry>;
  skeletons: Set<Skeleton>;
}

function occupiesVehicle(player: Player, target?: Entity): boolean {
  return (
    player.vehicleId !== undefined &&
    target?.id === player.vehicleId &&
    target.occupant === player.id
  );
}

/** Animation choices derive from authoritative state; local input only supplies unsent visual intent. */
export function selectCharacterClip(
  player: Player,
  target?: Entity,
  input?: InputFrame,
  aim = false,
): string {
  if (player.dead || player.eliminated) return "Death01";
  if (occupiesVehicle(player, target))
    return target?.type === "catapult" ? "Push_Loop" : "Sitting_Idle_Loop";
  if (player.action) {
    if (player.action.kind === "repair" || player.action.kind === "disarm")
      return "Fixing_Kneeling";
    if (player.action.kind === "gather" && player.tools <= 0) return "Interact";
    if (target?.type === "tree") return "TreeChopping_Loop";
    if (target?.type === "farm") return "Farm_Harvest";
    return player.action.kind === "gather" ? "Sword_Regular_A" : "Interact";
  }
  if (player.heal > 0) return "Consume";
  if (input?.attack || player.cooldown > 0)
    return player.weapons[player.slot] === "sword" ||
      player.weapons[player.slot] === "spear"
      ? "Sword_Attack"
      : player.weapons[player.slot]
        ? "Sword_Idle"
        : "Punch_Jab";
  return locomotionClip(player, aim);
}

function locomotionClip(player: Player, aim: boolean): string {
  if (Math.abs(player.vel.y) > 0.8)
    return player.vel.y > 1 ? "Jump_Loop" : "Jump_Land";
  const speed = Math.hypot(player.vel.x, player.vel.z);
  if (speed > 5) return "Sprint_Loop";
  if (speed > 2.7) return "Jog_Fwd_Loop";
  if (speed > 0.15) return "Walk_Loop";
  return aim ? "Sword_Idle" : "Idle_Loop";
}

/** Detailed imported skeletal actors. No simulation objects are created here. */
export class RigActors {
  private people = new Map<number, Rig>();
  private animals = new Map<number, Rig>();
  private frame = 0;
  constructor(
    private scene: Scene,
    private assets: Map<string, GLTF>,
  ) {}
  begin() {
    this.frame++;
    for (const rig of this.people.values()) {
      rig.seen = false;
      rig.root.visible = false;
    }
    for (const rig of this.animals.values()) {
      rig.seen = false;
      rig.root.visible = false;
    }
  }
  actor(player: Player, o: ActorOptions) {
    const outfit =
      player.armor > 0 && this.assets.has("ranger") ? "ranger" : "character";
    let rig = this.people.get(player.id);
    if (rig && rig.outfit !== outfit) {
      this.release(rig);
      this.people.delete(player.id);
      rig = undefined;
    }
    if (!rig) {
      rig = this.create(outfit, true);
      if (!rig) return;
      this.people.set(player.id, rig);
    }
    rig.seen = true;
    rig.lastSeen = this.frame;
    // Keep retention order by last visibility without allocating per-frame arrays.
    this.people.delete(player.id);
    this.people.set(player.id, rig);
    rig.root.visible = true;
    rig.root.position.set(o.pos.x, o.pos.y, o.pos.z);
    const horse =
      occupiesVehicle(player, o.workingTarget) &&
      o.workingTarget?.type === "horse"
        ? o.workingTarget
        : undefined;
    rig.root.rotation.y = -(horse?.yaw ?? o.yaw);
    rig.team.color.set(o.color);
    const dt = o.paused ? 0 : Math.max(0, Math.min(o.dt, 3));
    const dead = player.dead || player.eliminated;
    if (!dead && rig.dead) {
      rig.mixer.stopAllAction();
      rig.active = undefined;
      rig.clip = "";
      rig.deathTime = 0;
      rig.fading.clear();
      rig.transient = false;
      rig.strideYaw = 0;
    }
    if (dead) {
      if (!rig.dead) rig.deathTime = 0;
      rig.deathTime += dt;
      rig.root.visible = rig.deathTime < 2.6;
    }
    const hit = player.hp < rig.hp && !dead;
    const attack = player.cooldown > rig.cooldown + 0.0001;
    const consume = player.heal > rig.heal + 0.0001;
    rig.hp = player.hp;
    rig.cooldown = player.cooldown;
    rig.heal = player.heal;
    rig.dead = dead;
    let clip = selectCharacterClip(player, o.workingTarget, o.input, o.aim);
    let transient = false;
    let restart = false;
    if (!dead && !player.action && !occupiesVehicle(player, o.workingTarget)) {
      clip = locomotionClip(player, o.aim);
      const weapon = player.weapons[player.slot];
      const strike =
        weapon === "sword" || weapon === "spear"
          ? "Sword_Attack"
          : !weapon
            ? "Punch_Jab"
            : undefined;
      if (consume || (attack && strike)) {
        clip = consume ? "Consume" : strike!;
        transient = restart = true;
      } else if (
        rig.transient &&
        rig.active &&
        rig.active.time < rig.active.getClip().duration &&
        !rig.active.paused
      ) {
        clip = rig.clip;
        transient = true;
      }
    }
    if (
      !dead &&
      rig.transient &&
      rig.clip === "Hit_Chest" &&
      rig.active &&
      rig.active.time < rig.active.getClip().duration &&
      !rig.active.paused
    ) {
      clip = "Hit_Chest";
      transient = true;
    }
    if (hit) {
      clip = "Hit_Chest";
      transient = restart = true;
    }
    rig.transient = transient;
    this.play(rig, clip, dead || transient, restart);
    const walking =
      clip === "Walk_Loop" || clip === "Jog_Fwd_Loop" || clip === "Sprint_Loop";
    if (rig.active && walking) {
      const speed = Math.hypot(player.vel.x, player.vel.z);
      const forward =
        player.vel.x * Math.sin(o.yaw) - player.vel.z * Math.cos(o.yaw);
      const backward = forward < -speed * 0.2;
      rig.active.timeScale =
        (backward ? -1 : 1) *
        Math.max(
          0.65,
          Math.min(
            1.5,
            speed /
              (clip === "Walk_Loop" ? 2 : clip === "Jog_Fwd_Loop" ? 4 : 6),
          ),
        );
      let angle = Math.atan2(player.vel.x, -player.vel.z) - o.yaw;
      if (backward) angle += Math.PI;
      angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      const steer = Math.max(-0.85, Math.min(0.85, -angle));
      rig.strideYaw += (steer - rig.strideYaw) * (1 - Math.exp(-dt * 10));
    } else rig.strideYaw *= Math.exp(-dt * 10);
    // Restore additive corrections before the mixer writes this frame's absolute bone transforms.
    for (const [name, q] of rig.bind) {
      rig.bones.get(name)?.quaternion.copy(q);
    }
    this.advance(rig, dt);
    rig.bind.clear();
    if (!dead) {
      // Forward-only source clips steer the hips toward travel; the upper body retains aim.
      if (rig.bones.has("pelvis") && rig.bones.has("spine_01")) {
        this.adjust(rig, "pelvis", 0, rig.strideYaw);
        this.adjust(rig, "spine_01", 0, -rig.strideYaw);
      }
      const pitch = Math.max(-0.65, Math.min(0.65, o.pitch));
      for (const [name, weight] of [
        ["spine_03", 0.28],
        ["neck_01", 0.32],
        ["Head", 0.4],
      ] as const) {
        const bone = rig.bones.get(name);
        if (bone) {
          rig.bind.set(name, bone.quaternion.clone());
          bone.rotateX(pitch * weight);
        }
      }
      if (o.aim && !player.action)
        this.aim(rig, player.weapons[player.slot], pitch);
      if (horse) {
        this.riding(rig);
        const look = o.yaw - horse.yaw;
        const twist = Math.max(
          -1.1,
          Math.min(1.1, -Math.atan2(Math.sin(look), Math.cos(look))),
        );
        this.adjust(rig, "spine_03", 0, twist * 0.35);
        this.adjust(rig, "neck_01", 0, twist * 0.3);
        this.adjust(rig, "Head", 0, twist * 0.35);
      }
    }
    for (const [name, gear] of rig.gear) gear.visible = false;
    const tool = player.action
      ? player.tools <= 0
        ? null
        : o.workingTarget?.type === "tree"
          ? "axe"
          : o.workingTarget?.type === "stone" || o.workingTarget?.type === "ore"
            ? "pick"
            : o.workingTarget?.type === "farm"
              ? "sickle"
              : "hammer"
      : player.weapons[player.slot];
    if (tool && !dead) rig.gear.get(tool)!.visible = true;
    for (const plate of rig.armor) plate.visible = player.armor > 0;
  }
  animal(entity: Entity, o: AnimalOptions) {
    if (entity.type !== "horse" && entity.type !== "deer") return;
    let rig = this.animals.get(entity.id);
    if (rig && rig.outfit !== entity.type) {
      this.release(rig);
      this.animals.delete(entity.id);
      rig = undefined;
    }
    if (!rig) {
      rig = this.create(entity.type, false);
      if (!rig) return;
      this.animals.set(entity.id, rig);
    }
    rig.seen = true;
    rig.lastSeen = this.frame;
    this.animals.delete(entity.id);
    this.animals.set(entity.id, rig);
    rig.root.visible = true;
    rig.root.position.set(o.pos.x, o.pos.y, o.pos.z);
    rig.root.rotation.y = -o.yaw;
    const dead = entity.hp <= 0;
    this.play(
      rig,
      dead ? "Death" : o.speed > 3 ? "Gallop" : o.speed > 0.1 ? "Walk" : "Idle",
      dead,
    );
    this.advance(rig, o.paused ? 0 : Math.max(0, Math.min(o.dt, 0.1)));
  }
  end() {
    this.trim(this.people, 32);
    this.trim(this.animals, 64);
  }
  private trim(cache: Map<number, Rig>, retained: number) {
    let hidden = 0;
    for (const [id, rig] of cache) {
      if (rig.seen) continue;
      rig.root.visible = false;
      if (this.frame - rig.lastSeen > 600) {
        this.release(rig);
        cache.delete(id);
      } else hidden++;
    }
    // Most recently visible entries are last; evict only the oldest hidden rigs.
    for (const [id, rig] of cache) {
      if (hidden <= retained) break;
      if (!rig.seen) {
        this.release(rig);
        cache.delete(id);
        hidden--;
      }
    }
  }
  heading(id: number) {
    const rig = this.people.get(id);
    if (!rig) return;
    const forward = rig.root.children[0].getWorldDirection(new Vector3());
    return Math.atan2(forward.x, -forward.z);
  }
  metrics() {
    let bones = 0;
    for (const rig of this.people.values()) bones += rig.bones.size;
    for (const rig of this.animals.values()) bones += rig.bones.size;
    return { characters: this.people.size, animals: this.animals.size, bones };
  }
  dispose() {
    for (const rig of this.people.values()) this.release(rig);
    for (const rig of this.animals.values()) this.release(rig);
    this.people.clear();
    this.animals.clear();
  }
  private create(key: string, human: boolean): Rig | undefined {
    const source = this.assets.get(key);
    if (!source) return;
    const root = new Group(),
      orientation = new Group(),
      model = clone(source.scene);
    orientation.rotation.y = Math.PI;
    if (!human) model.scale.setScalar(0.4);
    orientation.add(model);
    root.add(orientation);
    const rig: Rig = {
      root,
      model,
      mixer: new AnimationMixer(model),
      bones: new Map(),
      actions: new Map(),
      clip: "",
      seen: true,
      lastSeen: this.frame,
      dead: false,
      deathTime: 0,
      hp: 100,
      cooldown: 0,
      heal: 0,
      transient: false,
      strideYaw: 0,
      fading: new Map(),
      gear: new Map(),
      armor: [],
      team: new MeshStandardMaterial({ color: 0x537254, roughness: 0.9 }),
      outfit: key,
      bind: new Map(),
      canonicalSkeletons: new Map(),
      materials: new Set(),
      geometries: new Set(),
      skeletons: new Set(),
    };
    model.traverse((node) => {
      if (node instanceof Bone) rig.bones.set(node.name, node);
    });
    this.cloneMaterials(model, rig);
    rig.materials.add(rig.team);
    if (human) {
      for (const name of ["head", "hair"]) this.attachSkin(rig, name);
      this.equipment(rig);
    }
    const clips = human
      ? [
          ...(this.assets.get("animations")?.animations ?? []),
          ...(this.assets.get("actions")?.animations ?? []),
        ]
      : source.animations;
    for (const sourceClip of clips) {
      const clip = sourceClip.clone();
      // In-place gameplay movement owns world translation; preserve animated vertical body motion.
      for (const track of clip.tracks)
        if (track.name === "root.position")
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = 0;
            track.values[i + 2] = 0;
          }
      rig.actions.set(clip.name, rig.mixer.clipAction(clip));
    }
    root.traverse((node) => {
      if (node !== root && !(node instanceof Bone)) {
        node.updateMatrix();
        node.matrixAutoUpdate = false;
      }
    });
    this.scene.add(root);
    return rig;
  }
  private cloneMaterials(object: Object3D, rig: Rig) {
    object.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
        node.material = Array.isArray(node.material)
          ? node.material.map((m) => m.clone())
          : node.material.clone();
        for (const mat of Array.isArray(node.material)
          ? node.material
          : [node.material])
          rig.materials.add(mat);
        if (node instanceof SkinnedMesh) {
          const key = node.skeleton.bones
            .map(
              (bone, i) =>
                bone.uuid +
                ":" +
                node.skeleton.boneInverses[i].elements.join(","),
            )
            .join("|");
          const shared = rig.canonicalSkeletons.get(key);
          if (shared && shared !== node.skeleton) {
            node.skeleton.dispose();
            node.skeleton = shared;
          } else rig.canonicalSkeletons.set(key, node.skeleton);
          rig.skeletons.add(node.skeleton);
        }
      }
    });
  }
  private attachSkin(rig: Rig, key: string) {
    const source = this.assets.get(key);
    if (!source) return;
    source.scene.updateMatrixWorld(true);
    source.scene.traverse((node) => {
      if (!(node instanceof SkinnedMesh)) return;
      const mapped = node.skeleton.bones.map((bone) =>
        rig.bones.get(bone.name),
      );
      if (mapped.some((bone) => !bone)) return;
      const mesh = node.clone(false) as SkinnedMesh;
      // The source Armature and mesh transforms are identity in this asset family. Retain any mesh transform
      // relative to its source scene, and all inverse binds, while replacing every bone by the outfit bone.
      const relative = source.scene.matrixWorld
        .clone()
        .invert()
        .multiply(node.matrixWorld);
      relative.decompose(mesh.position, mesh.quaternion, mesh.scale);
      const skeleton = new Skeleton(
        mapped as Bone[],
        node.skeleton.boneInverses.map((m) => m.clone()),
      );
      mesh.bind(skeleton, node.bindMatrix.clone());
      rig.model.add(mesh);
      this.cloneMaterials(mesh, rig);
    });
  }
  private play(rig: Rig, name: string, once = false, restart = false) {
    const action =
      rig.actions.get(name) ??
      rig.actions.get("Idle_Loop") ??
      rig.actions.get("Idle");
    if (!action || (!restart && rig.clip === name)) return;
    const previous = rig.active;
    // Missing optional clips must not reset the same fallback pose every frame.
    if (previous === action && !restart) {
      rig.clip = name;
      return;
    }
    rig.fading.delete(action);
    action
      .reset()
      .setEffectiveWeight(1)
      .setEffectiveTimeScale(1)
      .setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.play();
    if (previous && previous !== action) {
      action.crossFadeFrom(previous, 0.18, false);
      rig.fading.set(previous, rig.mixer.time + 0.18);
    }
    rig.active = action;
    rig.clip = name;
  }
  private advance(rig: Rig, dt: number) {
    rig.mixer.update(dt);
    for (const [action, until] of rig.fading)
      if (rig.mixer.time >= until) {
        if (action !== rig.active) action.stop();
        rig.fading.delete(action);
      }
  }
  private adjust(rig: Rig, name: string, x: number, y = 0, z = 0) {
    const bone = rig.bones.get(name);
    if (!bone) return;
    if (!rig.bind.has(name)) rig.bind.set(name, bone.quaternion.clone());
    bone.rotateX(x);
    bone.rotateY(y);
    bone.rotateZ(z);
  }
  private aim(rig: Rig, weapon: Weapon | null, pitch: number) {
    if (weapon === "bow") {
      this.adjust(rig, "upperarm_l", -0.8, 0, -0.7);
      this.adjust(rig, "lowerarm_l", -0.2);
      this.adjust(rig, "upperarm_r", -0.5, 0, 0.7);
      this.adjust(rig, "lowerarm_r", -1.2);
    } else if (weapon === "crossbow") {
      this.adjust(rig, "upperarm_r", -0.8 - pitch * 0.3, 0, 0.2);
      this.adjust(rig, "lowerarm_r", -0.8);
      this.adjust(rig, "upperarm_l", -0.65, 0, -0.3);
      this.adjust(rig, "lowerarm_l", -0.95);
    }
  }
  private riding(rig: Rig) {
    this.adjust(rig, "thigh_l", -0.1, 0, -0.3);
    this.adjust(rig, "thigh_r", -0.1, 0, 0.3);
    this.adjust(rig, "calf_l", 0.3);
    this.adjust(rig, "calf_r", 0.3);
  }
  private mesh(
    rig: Rig,
    geometry: BufferGeometry,
    material: Material,
    parent: Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    rig.geometries.add(geometry);
    rig.materials.add(material);
    return mesh;
  }
  private equipment(rig: Rig) {
    const steel = new MeshStandardMaterial({
        color: 0x8b969b,
        metalness: 0.82,
        roughness: 0.32,
      }),
      darkSteel = new MeshStandardMaterial({
        color: 0x343c40,
        metalness: 0.7,
        roughness: 0.48,
      }),
      wood = new MeshStandardMaterial({ color: 0x553522, roughness: 0.86 }),
      leather = new MeshStandardMaterial({ color: 0x30201a, roughness: 0.95 });
    const socket = (name: string, left = false) => {
      const gear = new Group();
      gear.name = `equipment-${name}`;
      gear.position.set(0, 0.06, 0);
      (rig.bones.get(left ? "hand_l" : "hand_r") ?? rig.model).add(gear);
      rig.gear.set(name, gear);
      return gear;
    };
    const shaft = (parent: Object3D, length: number, radius = 0.018) =>
      this.mesh(
        rig,
        new CylinderGeometry(radius * 0.8, radius, length, 10),
        wood,
        parent,
        0,
        length / 2 - 0.1,
        0,
      );
    const blade = (
      parent: Object3D,
      length: number,
      width: number,
      y: number,
      material = steel,
    ) => {
      const shape = new Shape();
      shape.moveTo(-width * 0.45, 0);
      shape.lineTo(-width * 0.5, length * 0.72);
      shape.lineTo(0, length);
      shape.lineTo(width * 0.5, length * 0.72);
      shape.lineTo(width * 0.45, 0);
      shape.closePath();
      const mat = material.clone();
      mat.side = DoubleSide;
      return this.mesh(rig, new ShapeGeometry(shape), mat, parent, 0, y, 0);
    };
    const sword = socket("sword");
    this.mesh(
      rig,
      new CylinderGeometry(0.023, 0.025, 0.19, 12),
      leather,
      sword,
      0,
      -0.02,
      0,
    );
    this.mesh(rig, new SphereGeometry(0.036, 12, 8), steel, sword, 0, -0.13, 0);
    const guard = this.mesh(
      rig,
      new TorusGeometry(0.1, 0.015, 8, 20, Math.PI),
      steel,
      sword,
      0,
      0.08,
      0,
    );
    guard.rotation.z = Math.PI;
    blade(sword, 0.66, 0.095, 0.09);
    this.mesh(
      rig,
      new CylinderGeometry(0.004, 0.012, 0.59, 6),
      darkSteel,
      sword,
      0,
      0.36,
      0.004,
    );
    const spear = socket("spear");
    shaft(spear, 1.5, 0.019);
    blade(spear, 0.27, 0.11, 1.38);
    this.mesh(
      rig,
      new CylinderGeometry(0.025, 0.02, 0.1, 10),
      steel,
      spear,
      0,
      1.36,
      0,
    );
    const bow = socket("bow", true);
    const curve = new CatmullRomCurve3([
      new Vector3(0, -0.52, 0),
      new Vector3(0, -0.32, 0.15),
      new Vector3(0, 0, 0.23),
      new Vector3(0, 0.32, 0.15),
      new Vector3(0, 0.52, 0),
    ]);
    this.mesh(rig, new TubeGeometry(curve, 28, 0.019, 8, false), wood, bow);
    this.mesh(rig, new CylinderGeometry(0.002, 0.002, 1.04, 5), leather, bow);
    this.mesh(rig, new CylinderGeometry(0.025, 0.025, 0.13, 12), leather, bow);
    const crossbow = socket("crossbow");
    crossbow.rotation.x = Math.PI / 2;
    shaft(crossbow, 0.55, 0.034);
    const limb = new CatmullRomCurve3([
      new Vector3(-0.32, 0.36, 0.02),
      new Vector3(-0.16, 0.4, 0.04),
      new Vector3(0, 0.42, 0.09),
      new Vector3(0.16, 0.4, 0.04),
      new Vector3(0.32, 0.36, 0.02),
    ]);
    this.mesh(rig, new TubeGeometry(limb, 20, 0.018, 8, false), wood, crossbow);
    const string = this.mesh(
      rig,
      new CylinderGeometry(0.002, 0.002, 0.64, 5),
      leather,
      crossbow,
      0,
      0.36,
      0.02,
    );
    string.rotation.z = Math.PI / 2;
    for (const name of ["axe", "pick", "hammer", "sickle"]) {
      const tool = socket(name);
      shaft(tool, 0.55, 0.022);
      if (name === "axe") {
        const shape = new Shape();
        shape.moveTo(0, 0.36);
        shape.quadraticCurveTo(0.14, 0.34, 0.25, 0.39);
        shape.quadraticCurveTo(0.32, 0.53, 0.23, 0.66);
        shape.quadraticCurveTo(0.15, 0.55, 0, 0.57);
        shape.closePath();
        const mat = steel.clone();
        mat.side = DoubleSide;
        this.mesh(rig, new ShapeGeometry(shape), mat, tool);
      } else if (name === "pick") {
        const arc = new CatmullRomCurve3([
          new Vector3(-0.22, 0.38, 0),
          new Vector3(-0.12, 0.54, 0),
          new Vector3(0, 0.58, 0),
          new Vector3(0.18, 0.51, 0),
          new Vector3(0.28, 0.42, 0),
        ]);
        this.mesh(rig, new TubeGeometry(arc, 18, 0.018, 8, false), steel, tool);
      } else if (name === "sickle") {
        const hook = this.mesh(
          rig,
          new TorusGeometry(0.13, 0.014, 8, 22, Math.PI * 1.35),
          steel,
          tool,
          0.1,
          0.5,
          0,
        );
        hook.rotation.z = -0.7;
      } else {
        const head = this.mesh(
          rig,
          new CylinderGeometry(0.05, 0.05, 0.17, 8),
          steel,
          tool,
          0,
          0.52,
          0,
        );
        head.rotation.z = Math.PI / 2;
      }
    }
    // Faction identification is cloth and trim, never skin or the imported eye materials.
    const chest = rig.bones.get("spine_03"),
      head = rig.bones.get("Head");
    if (chest) {
      const brooch = this.mesh(
        rig,
        new SphereGeometry(0.065, 12, 10),
        rig.team,
        chest,
        0.12,
        0.02,
        0.09,
      );
      brooch.scale.set(1, 1, 0.22);
    }
    if (head) {
      const helmet = this.mesh(
        rig,
        new SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48),
        steel,
        head,
        0,
        0.08,
        0,
      );
      helmet.scale.set(1, 1, 1.15);
      rig.armor.push(helmet);
    }
    for (const side of ["l", "r"]) {
      const shoulder = rig.bones.get(`upperarm_${side}`);
      if (shoulder) {
        const plate = this.mesh(
          rig,
          new SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7),
          darkSteel,
          shoulder,
          0,
          0.05,
          0,
        );
        plate.scale.set(1, 1.2, 1);
        rig.armor.push(plate);
      }
    }
  }
  private release(rig: Rig) {
    rig.mixer.stopAllAction();
    rig.mixer.uncacheRoot(rig.model);
    this.scene.remove(rig.root);
    for (const material of rig.materials) material.dispose();
    for (const geometry of rig.geometries) geometry.dispose();
    for (const skeleton of rig.skeletons) skeleton.dispose();
  }
}
