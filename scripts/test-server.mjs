import { startServer } from "../dist-server/index.mjs";
const server = await startServer({
  port: 5198,
  host: "0.0.0.0",
  dataDir: false,
});
console.log("Test server ready");
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, () => void server.close().then(() => process.exit(0)));
