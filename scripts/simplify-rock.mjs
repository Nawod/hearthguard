import { readFile, writeFile } from "node:fs/promises";
import { MeshoptSimplifier } from "three/addons/libs/meshopt_simplifier.module.js";
const path = new URL("../public/models/rock.glb", import.meta.url),
  file = await readFile(path),
  jsonLength = file.readUInt32LE(12),
  data = JSON.parse(file.subarray(20, 20 + jsonLength).toString()),
  binary = file.subarray(28 + jsonLength);
await MeshoptSimplifier.ready;
let chunks = [binary],
  length = binary.length;
const components = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
function values(accessor, width) {
  const a = data.accessors[accessor],
    v = data.bufferViews[a.bufferView],
    Type = components[a.componentType],
    out = new Type(a.count * width);
  for (let i = 0; i < a.count; i++) {
    const offset =
      (v.byteOffset ?? 0) +
      (a.byteOffset ?? 0) +
      i * (v.byteStride ?? width * Type.BYTES_PER_ELEMENT);
    for (let c = 0; c < width; c++)
      out[i * width + c] = new Type(
        binary.buffer,
        binary.byteOffset + offset + c * Type.BYTES_PER_ELEMENT,
        1,
      )[0];
  }
  return out;
}
for (const mesh of data.meshes)
  for (const primitive of mesh.primitives) {
    const indices = values(primitive.indices, 1),
      positions = values(primitive.attributes.POSITION, 3),
      uv = values(primitive.attributes.TEXCOORD_0, 2);
    if (indices.length < 30000) continue;
    const [simplified] = MeshoptSimplifier.simplifyWithAttributes(
      indices,
      positions,
      3,
      uv,
      2,
      [0.5, 0.5],
      null,
      18000,
      1,
    );
    const padding = (4 - (length % 4)) % 4;
    chunks.push(Buffer.alloc(padding));
    length += padding;
    const output = Buffer.from(new Uint32Array(simplified).buffer);
    const view = data.bufferViews.length;
    data.bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: output.length,
      target: 34963,
    });
    const accessor = data.accessors.length;
    data.accessors.push({
      bufferView: view,
      componentType: 5125,
      count: simplified.length,
      type: "SCALAR",
    });
    primitive.indices = accessor;
    chunks.push(output);
    length += output.length;
    console.log(
      `Rock triangles ${indices.length / 3} -> ${simplified.length / 3}`,
    );
  }
data.buffers[0].byteLength = length;
let json = Buffer.from(JSON.stringify(data));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const bin = Buffer.concat([...chunks, Buffer.alloc((4 - (length % 4)) % 4)]),
  header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
await writeFile(path, Buffer.concat([header, json, bh, bin]));
