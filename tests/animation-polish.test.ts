import { describe, expect, it } from "vitest";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LoopOnce,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Scene,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { RigActors } from "../src/render/rigs";
import { emptyInput, emptyStock, type Player } from "../src/game/types";

// Real mixers, skeleton clones and action tracks expose repetition, blending and disposal.
function fixture() {
  const model = new Group();
  const root = new Bone(),
    pelvis = new Bone(),
    spine = new Bone();
  const upperSpine = new Bone(),
    neck = new Bone(),
    head = new Bone();
  root.name = "root";
  pelvis.name = "pelvis";
  spine.name = "spine_01";
  upperSpine.name = "spine_03";
  neck.name = "neck_01";
  head.name = "Head";
  spine.add(upperSpine);
  upperSpine.add(neck);
  neck.add(head);
  root.add(pelvis);
  pelvis.add(spine);
  model.add(root);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute(
    "skinIndex",
    new Uint16BufferAttribute([0, 0, 0, 0], 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute([1, 0, 0, 0], 4),
  );
  const skin = new SkinnedMesh(geometry, new MeshStandardMaterial());
  model.add(skin);
  model.updateMatrixWorld(true);
  skin.bind(new Skeleton([root, pelvis, spine, upperSpine, neck, head]));
  const clips = [
    "Idle_Loop",
    "Walk_Loop",
    "Jog_Fwd_Loop",
    "Sprint_Loop",
    "Sword_Attack",
    "Punch_Jab",
    "Consume",
    "Hit_Chest",
    "Death01",
    "Idle",
    "Walk",
  ].map(
    (name) =>
      new AnimationClip(name, 0.6, [
        new NumberKeyframeTrack("root.position[y]", [0, 0.6], [0, 0.12]),
      ]),
  );
  const asset = { scene: model, animations: clips } as unknown as GLTF;
  const scene = new Scene();
  const actors = new RigActors(
    scene,
    new Map([
      ["character", asset],
      ["animations", asset],
      ["deer", asset],
    ]),
  );
  const player: Player = {
    id: 1,
    name: "Tester",
    controller: "human",
    faction: 0,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    hp: 100,
    lives: 3,
    dead: false,
    eliminated: false,
    respawnAt: 0,
    protectionUntil: 0,
    pack: emptyStock(),
    weapons: ["sword", null],
    slot: 0,
    ammo: { arrow: 0, bolt: 0, catapult: 0 },
    tools: 1,
    armor: 0,
    cooldown: 0,
    heal: 0,
    healUntil: 0,
    eatReady: 0,
    input: emptyInput(),
    lastSeq: 0,
    ai: { next: 0, phase: "idle", raid: false },
    deathTick: 0,
  };
  const options = {
    pos: player.pos,
    yaw: 0,
    pitch: 0,
    aim: false,
    input: player.input,
    color: "#fff",
    dt: 0.1,
    tick: 1,
  };
  const frame = (patch: Partial<Player> = {}, dt = 0.1) => {
    Object.assign(player, patch);
    actors.begin();
    actors.actor(player, { ...options, dt });
    actors.end();
  };
  const rigs = actors as unknown as {
    people: Map<
      number,
      {
        mixer: AnimationMixer;
        active: AnimationAction;
        actions: Map<string, AnimationAction>;
      }
    >;
  };
  const rig = () => rigs.people.get(player.id)!;
  return { actors, player, scene, asset, frame, rig, options };
}

describe("animation continuity and retained rig lifecycle", () => {
  it("plays a strike once per cooldown onset and finishes it after input is released", () => {
    const f = fixture();
    f.player.input.attack = true;
    f.frame({ cooldown: 0.7 });
    const strike = f.rig().actions.get("Sword_Attack")!;
    expect(strike.loop).toBe(LoopOnce);
    f.player.input.attack = false;
    f.frame({ cooldown: 0 });
    expect(f.rig().active).toBe(strike);
    for (let i = 0; i < 8; i++) f.frame({ cooldown: 0.01 });
    expect(f.rig().active.getClip().name).toBe("Idle_Loop");
    f.frame({ cooldown: 0.7 });
    expect(f.rig().active).toBe(strike);
    expect(strike.time).toBeCloseTo(0.1);
    f.actors.dispose();
  });

  it("does not repeat consumption during healing and replays a hit only for new damage", () => {
    const g = fixture();
    g.frame();
    g.frame({ heal: 25 });
    expect(g.rig().active.getClip().name).toBe("Consume");
    expect(g.rig().active.loop).toBe(LoopOnce);
    for (let i = 0; i < 9; i++) g.frame({ heal: 15 });
    expect(g.rig().active.getClip().name).toBe("Idle_Loop");
    g.frame({ hp: 90 });
    const hit = g.rig().active;
    expect(hit.getClip().name).toBe("Hit_Chest");
    expect(hit.loop).toBe(LoopOnce);
    g.frame();
    g.frame({ hp: 80 });
    expect(hit.time).toBeCloseTo(0.1);
    for (let i = 0; i < 8; i++) g.frame();
    expect(g.rig().active.getClip().name).toBe("Idle_Loop");
    g.actors.dispose();
  });

  it("stops outgoing mixer actions after the fade while allowing them to be reused", () => {
    const f = fixture();
    f.frame();
    const idle = f.rig().active;
    f.frame({ vel: { x: 0, y: 0, z: -1 } });
    const walk = f.rig().active;
    f.frame();
    f.frame();
    expect(idle.isScheduled()).toBe(false);
    f.frame({ vel: { x: 0, y: 0, z: 0 } });
    expect(f.rig().active).toBe(idle);
    f.frame();
    f.frame();
    expect(idle.isRunning()).toBe(true);
    expect(walk.isScheduled()).toBe(false);
    f.actors.dispose();
  });

  it("reverses backward gait and steers strafing legs while keeping torso aim facing", () => {
    const f = fixture();
    f.frame({ vel: { x: 0, y: 0, z: 1 } });
    expect(f.rig().active.timeScale).toBeLessThan(0);
    f.frame({ vel: { x: 1, y: 0, z: 0 } });
    expect(f.rig().active.timeScale).toBeGreaterThan(0);
    const pelvis = f.scene.getObjectByName("pelvis")!;
    const spine = f.scene.getObjectByName("spine_01")!;
    expect(pelvis.rotation.y).toBeLessThan(-0.1);
    expect(pelvis.rotation.y + spine.rotation.y).toBeCloseTo(0, 5);
    expect(f.scene.children[0].rotation.y).toBeCloseTo(0);
    f.actors.dispose();
  });

  it("freezes hidden rigs, retains temporary visibility gaps and disposes long absent resources", () => {
    const f = fixture();
    f.frame();
    const retained = f.rig();
    const time = retained.mixer.time;
    for (let i = 0; i < 30; i++) {
      f.actors.begin();
      f.actors.end();
    }
    expect(retained.mixer.time).toBe(time);
    f.frame();
    expect(f.rig()).toBe(retained);
    let materialDisposals = 0,
      geometryDisposals = 0,
      sourceDisposals = 0;
    let skeletonTextureDisposals = 0;
    f.scene.traverse((node) => {
      if (node instanceof SkinnedMesh) {
        (node.material as MeshStandardMaterial).addEventListener(
          "dispose",
          () => materialDisposals++,
        );
        node.skeleton.computeBoneTexture();
        node.skeleton.boneTexture!.addEventListener(
          "dispose",
          () => skeletonTextureDisposals++,
        );
      }
      if (node.type === "Mesh")
        (node as SkinnedMesh).geometry.addEventListener(
          "dispose",
          () => geometryDisposals++,
        );
    });
    (f.asset.scene.children[1] as SkinnedMesh).geometry.addEventListener(
      "dispose",
      () => sourceDisposals++,
    );
    for (let i = 0; i < 601; i++) {
      f.actors.begin();
      f.actors.end();
    }
    expect(f.actors.metrics().characters).toBe(0);
    expect(f.scene.children).toHaveLength(0);
    expect(materialDisposals).toBe(1);
    expect(geometryDisposals).toBeGreaterThan(0);
    expect(sourceDisposals).toBe(0);
    expect(skeletonTextureDisposals).toBe(1);
    f.actors.dispose();
    expect(materialDisposals).toBe(1);
  });

  it("anchors an occupied rider to horse heading with a bounded look twist", () => {
    const f = fixture();
    f.player.vehicleId = 2;
    f.actors.begin();
    f.actors.actor(f.player, {
      ...f.options,
      yaw: 2,
      workingTarget: { id: 2, type: "horse", occupant: 1, yaw: 0.4 } as any,
    });
    f.actors.end();
    expect(f.scene.children[0].rotation.y).toBeCloseTo(-0.4);
    const upper = f.scene.getObjectByName("spine_03")!;
    const neck = f.scene.getObjectByName("neck_01")!;
    const head = f.scene.getObjectByName("Head")!;
    const twist = upper.rotation.y + neck.rotation.y + head.rotation.y;
    expect(twist).toBeLessThan(-0.1);
    expect(Math.abs(twist)).toBeLessThanOrEqual(1.15);
    f.frame({ vehicleId: undefined });
    expect(f.scene.children[0].rotation.y).toBeCloseTo(0);
    expect(head.rotation.y).toBeCloseTo(0);
    f.actors.dispose();
  });

  it("bounds cache churn while preserving visible characters and animals", () => {
    const f = fixture();
    for (let id = 1; id <= 120; id++) {
      f.actors.begin();
      f.actors.actor({ ...f.player, id }, f.options);
      f.actors.animal({ id, type: "deer", hp: 100 } as any, {
        ...f.options,
        speed: 1,
      });
      f.actors.end();
    }
    expect(f.actors.metrics().characters).toBeLessThanOrEqual(33);
    expect(f.actors.metrics().animals).toBeLessThanOrEqual(65);
    expect(f.scene.children.filter((root) => root.visible)).toHaveLength(2);
    f.actors.dispose();
    expect(f.scene.children).toHaveLength(0);
  });
});

it.each(["work", "horse"] as const)(
  "holds a damage reaction while %s is active, then returns to that pose",
  (kind) => {
    const f = fixture();
    if (kind === "work") f.player.action = { kind: "work", target: 99 };
    else f.player.vehicleId = 2;
    const options = {
      ...f.options,
      workingTarget:
        kind === "horse"
          ? ({ id: 2, type: "horse", occupant: 1, yaw: 0.2 } as any)
          : undefined,
    };
    const frame = (hp: number) => {
      f.player.hp = hp;
      f.actors.begin();
      f.actors.actor(f.player, options);
      f.actors.end();
    };
    frame(100);
    frame(90);
    frame(90);
    expect(f.rig().active.getClip().name).toBe("Hit_Chest");
    for (let i = 0; i < 8; i++) frame(90);
    expect(f.rig().active.getClip().name).toBe("Idle_Loop");
    f.actors.dispose();
  },
);
