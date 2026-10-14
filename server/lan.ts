import { networkInterfaces } from "node:os";
export function getLanAddresses(port = 5190): string[] {
  return Object.values(networkInterfaces()).flatMap((a) =>
    (a ?? [])
      .filter((v) => v.family === "IPv4" && !v.internal)
      .map((v) => `http://${v.address}:${port}`),
  );
}
export function inviteURL(base: string, code: string): string {
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use a valid server address.");
  return new URL("?room=" + encodeURIComponent(code), url.origin).href;
}
