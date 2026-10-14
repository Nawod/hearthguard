import { it, expect } from "vitest";
import { inviteURL, getLanAddresses } from "../server/lan";
it("invites preserve the selected LAN origin without credentials", () => {
  expect(inviteURL("http://192.168.1.24:5190", "ABC123")).toBe(
    "http://192.168.1.24:5190/?room=ABC123",
  );
  expect(() => inviteURL("javascript:alert(1)", "ABC123")).toThrow();
  expect(() => inviteURL("http://secret:pass@localhost", "ABC123")).toThrow();
  for (const address of getLanAddresses())
    expect(address).toMatch(/^http:\/\/(?!127\.)\d+\.\d+\.\d+\.\d+:5190$/);
});
