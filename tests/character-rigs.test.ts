import { describe, it, expect } from "vitest";
import {
  Bone,
  Group,
  Scene,
  SkinnedMesh,
  Skeleton,
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  MeshStandardMaterial,
  AnimationClip,
  QuaternionKeyframeTrack,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { Player } from "../src/game/types";
import { RigActors, selectCharacterClip } from "../src/render/rigs";

const player = (patch: Partial<Player> = {}): Player =>
  ({
    id: 1,
    vel: { x: 0, y: 0, z: 0 },
    weapons: ["sword", "bow"],
    slot: 0,
    tools: 1,
    armor: 0,
    hp: 100,
    heal: 0,
    cooldown: 0,
    dead: false,
    eliminated: false,
    ...patch,
  }) as Player;
function model(name = "Body"): GLTF {
  const scene = new Group(),
    root = new Bone(),
    head = new Bone(),
    hand = new Bone();
  root.name = "root";
  head.name = "Head";
  hand.name = "hand_r";
  root.add(head, hand);
  scene.add(root);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([0, 0, 0, 0, 1, 0, 1, 0, 0], 3),
  );
  geometry.setAttribute(
    "skinIndex",
    new Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
  mesh.name = name;
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new Skeleton([root, head, hand]));
  return {
    scene,
    animations: [
      new AnimationClip("Idle_Loop", 1, [
        new QuaternionKeyframeTrack(
          "Head.quaternion",
          [0, 1],
          [0, 0, 0, 1, 0, 0.2, 0, 0.98],
        ),
      ]),
    ],
  } as GLTF;
}
const options = {
  pos: { x: 1, y: 0, z: 2 },
  yaw: 0.7,
  pitch: 0,
  aim: false,
  color: "#ee4400",
  dt: 0.2,
  tick: 1,
};
describe("detailed character rigs", () => {
  it("selects work and mounted animation ahead of locomotion and death ahead of all actions", () => {
    expect(
      selectCharacterClip(player({ action: { kind: "gather", target: 2 } }), {
        type: "tree",
      } as any),
    ).toBe("TreeChopping_Loop");
    expect(
      selectCharacterClip(player({ action: { kind: "gather", target: 2 } }), {
        type: "farm",
      } as any),
    ).toBe("Farm_Harvest");
    expect(
      selectCharacterClip(player({ vehicleId: 2, vel: { x: 3, y: 0, z: 0 } }), {
        id: 2,
        type: "horse",
        occupant: 1,
      } as any),
    ).toBe("Sitting_Idle_Loop");
    expect(selectCharacterClip(player({ dead: true, vehicleId: 2 }))).toBe(
      "Death01",
    );
    expect(selectCharacterClip(player({ vel: { x: 0, y: 2, z: 0 } }))).toBe(
      "Jump_Loop",
    );
    expect(selectCharacterClip(player({ vel: { x: 4, y: 0, z: 0 } }))).toBe(
      "Jog_Fwd_Loop",
    );
  });
  it("keeps an owned parked vehicle from overriding idle or walking and requires matching occupancy", () => {
    expect(
      selectCharacterClip(player({ vehicleId: 2 }), {
        id: 2,
        type: "horse",
      } as any),
    ).toBe("Idle_Loop");
    expect(
      selectCharacterClip(player({ vehicleId: 2, vel: { x: 1, y: 0, z: 0 } }), {
        id: 2,
        type: "horse",
      } as any),
    ).toBe("Walk_Loop");
    expect(
      selectCharacterClip(player({ vehicleId: 2 }), {
        id: 3,
        type: "horse",
        occupant: 1,
      } as any),
    ).toBe("Idle_Loop");
    expect(
      selectCharacterClip(player({ vehicleId: 2 }), {
        id: 2,
        type: "catapult",
        occupant: 2,
      } as any),
    ).toBe("Idle_Loop");
    expect(
      selectCharacterClip(player({ vehicleId: 2 }), {
        id: 2,
        type: "catapult",
        occupant: 1,
      } as any),
    ).toBe("Push_Loop");
  });
  it("gathers with bare hands without displaying an unavailable tool", () => {
    const p = player({ tools: 0, action: { kind: "gather", target: 2 } }),
      target = { id: 2, type: "tree" } as any;
    expect(selectCharacterClip(p, target)).toBe("Interact");
    const scene = new Scene(),
      rig = new RigActors(scene, new Map([["character", model()]]));
    rig.begin();
    rig.actor(p, { ...options, workingTarget: target });
    rig.end();
    expect(scene.getObjectByName("equipment-axe")!.visible).toBe(false);
    expect(scene.getObjectByName("equipment-sword")!.visible).toBe(false);
  });
  it("rebinds face and hair to each independently animated outfit skeleton", () => {
    const scene = new Scene(),
      source = model(),
      rig = new RigActors(
        scene,
        new Map([
          ["character", source],
          ["head", model("Face")],
          ["hair", model("Hair")],
          ["animations", source],
        ]),
      );
    rig.begin();
    rig.actor(player(), options);
    rig.actor(player({ id: 2 }), options);
    rig.end();
    const skins: SkinnedMesh[] = [];
    scene.traverse((x) => {
      if (x instanceof SkinnedMesh) skins.push(x);
    });
    expect(skins).toHaveLength(6);
    expect(skins[0].skeleton.bones[1]).toBe(skins[1].skeleton.bones[1]);
    expect(skins[0].skeleton.bones[1]).not.toBe(skins[3].skeleton.bones[1]);
    expect(skins[0].skeleton.bones[1].quaternion.y).not.toBe(0);
    expect((source.scene.getObjectByName("Head") as Bone).quaternion.y).toBe(0);
    rig.begin();
    rig.actor(player(), { ...options, yaw: 1.2 });
    rig.end();
    expect(scene.children[0].rotation.y).toBe(-1.2);
    expect(scene.children[1].visible).toBe(false);
    rig.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it("replaces animal rigs when a different world reuses an entity id for another species", () => {
    const scene = new Scene(),
      rig = new RigActors(
        scene,
        new Map([
          ["deer", model("Deer")],
          ["horse", model("Horse")],
        ]),
      );
    rig.begin();
    rig.animal({ id: 99, type: "deer", hp: 100 } as any, {
      ...options,
      speed: 0,
    });
    rig.end();
    expect(scene.getObjectByName("Deer")).toBeDefined();
    rig.begin();
    rig.animal({ id: 99, type: "horse", hp: 100 } as any, {
      ...options,
      speed: 0,
    });
    rig.end();
    expect(scene.getObjectByName("Deer")).toBeUndefined();
    expect(scene.getObjectByName("Horse")).toBeDefined();
  });
  it("holds death once, hides a corpse after its display window, and resets on respawn", () => {
    const scene = new Scene(),
      rig = new RigActors(scene, new Map([["character", model()]]));
    rig.begin();
    rig.actor(player({ dead: true }), { ...options, dt: 0 });
    rig.end();
    expect(scene.children[0].visible).toBe(true);
    rig.begin();
    rig.actor(player({ dead: true }), { ...options, dt: 3 });
    rig.end();
    expect(scene.children[0].visible).toBe(false);
    rig.begin();
    rig.actor(player(), options);
    rig.end();
    expect(scene.children[0].visible).toBe(true);
  });
});
