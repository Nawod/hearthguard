import type { SaveEnvelope } from "../game/types";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(new Error("Local saves are unavailable in this browser."));
    const r = indexedDB.open("hearthguard-saves", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("matches", { keyPath: "slot" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Allow local storage and try again.",
        ),
      );
  });
}
export async function writeSave(
  slot: "manual" | "auto",
  save: SaveEnvelope,
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("matches", "readwrite");
      tx.objectStore("matches").put({ slot, save, date: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error("Could not save. Browser storage may be full."));
    });
  } finally {
    db.close();
  }
}
export async function readSave(
  slot: "manual" | "auto",
): Promise<SaveEnvelope | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("matches").objectStore("matches").get(slot);
      r.onsuccess = () => resolve(r.result?.save ?? null);
      r.onerror = () => reject(new Error("Could not read the saved match."));
    });
  } finally {
    db.close();
  }
}
