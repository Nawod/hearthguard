import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
/** Serialize writes so periodic saves and shutdown cannot race on the temp file. */
export class Checkpoints {
  private tail = Promise.resolve();
  constructor(private directory: string) {}
  write(code: string, value: unknown): Promise<void> {
    if (!/^[A-F0-9]{6}$/.test(code))
      return Promise.reject(new Error("Invalid checkpoint name."));
    const bytes = JSON.stringify(value);
    const task = this.tail.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const path = resolve(this.directory, code + ".json");
      await writeFile(path + ".tmp", bytes);
      await rename(path + ".tmp", path);
    });
    this.tail = task.catch(() => {});
    return task;
  }
  remove(code: string): Promise<void> {
    if (!/^[A-F0-9]{6}$/.test(code))
      return Promise.reject(new Error("Invalid checkpoint name."));
    const task = this.tail.then(() =>
      unlink(resolve(this.directory, code + ".json")),
    );
    this.tail = task.catch(() => {});
    return task;
  }
  flush(): Promise<void> {
    return this.tail;
  }
}
