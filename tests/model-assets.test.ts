import {it,expect} from "vitest";
import {readFileSync} from "node:fs";
it("the local medieval character asset is a real skin with joint weights and humanoid bones",()=>{
 const bytes=readFileSync("public/models/character.glb");expect(bytes.toString("ascii",0,4)).toBe("glTF");const length=bytes.readUInt32LE(12),data=JSON.parse(bytes.toString("utf8",20,20+length));expect(data.skins[0].joints.length).toBeGreaterThan(15);expect(data.meshes.some((m:any)=>m.primitives.some((p:any)=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined))).toBe(true);
});
it("animation assets contain actual skeletal movement clips, not rotating boxes",()=>{
 const bytes=readFileSync("public/models/animations.glb"),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.toString("utf8",20,20+length));expect(data.animations.length).toBeGreaterThan(5);expect(data.animations.some((a:any)=>a.channels.length>15)).toBe(true);
});
