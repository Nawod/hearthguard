import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir("dist-server", { recursive: true });
await build({
  entryPoints: ["server/index.ts", "server/match.worker.ts"],
  outdir: "dist-server",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
  sourcemap: true,
});
