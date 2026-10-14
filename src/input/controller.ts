import { emptyInput } from "../game/types";
import type { InputFrame, Vec3 } from "../game/types";
export class InputController {
  frame = emptyInput();
  active = false;
  private keys = new Set<string>();
  private seq = 0;
  private touchLook?: { id: number; x: number; y: number };
  private mouseAttack = false;
  private mouseAim = false;
  private attackPress = false;
  private mousePosition?: { x: number; y: number };
  constructor(
    private canvas: HTMLCanvasElement,
    private action: (name: string) => boolean | void,
    private aimOrigin?: () => Vec3 | undefined,
  ) {
    window.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.releaseAll);
    document.addEventListener("pointerlockchange", this.lock);
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("mousedown", this.mouseDown);
    window.addEventListener("mouseup", this.mouseUp);
    canvas.addEventListener("pointermove", this.move);
    window.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.releaseAll);
    canvas.addEventListener("contextmenu", this.context);
  }
  private context = (e: Event) => e.preventDefault();
  private lock = () => {
    if (document.pointerLockElement !== this.canvas) this.releaseAll();
  };
  private keydown = (e: KeyboardEvent) => {
    if (
      !this.active ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    if (["Space", "Tab"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyE") this.action("interact");
    if (e.code === "KeyB") this.action("build");
    if (e.code === "KeyC" || e.code === "Tab") this.action("craft");
    if (e.code === "KeyF") this.action("eat");
    if (e.code === "KeyG") this.action("mount");
    if (e.code === "Digit1") this.frame.weaponSlot = 0;
    if (e.code === "Digit2") this.frame.weaponSlot = 1;
    if (e.code === "Escape") this.action("menu");
  };
  private keyup = (e: KeyboardEvent) => this.keys.delete(e.code);
  private down = (e: PointerEvent) => {
    if (!this.active) return;
    if (e.pointerType !== "mouse") {
      e.preventDefault();
      if (this.touchLook) return;
      this.touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    }
  };
  // Pointer events omit the second button of a mouse chord. Mouse events handle RMB + LMB independently.
  private mouseDown = (e: MouseEvent) => {
    if (!this.active) return;
    if (e.button === 0) {
      if (this.action("primary")) return;
      this.mouseAttack = true;
      this.pressAttack();
      this.canvas.requestPointerLock?.();
    }
    if (e.button === 2) {
      e.preventDefault();
      this.mouseAim = true;
      this.mousePosition = { x: e.clientX, y: e.clientY };
      this.canvas.requestPointerLock?.();
    }
  };
  private move = (e: PointerEvent) => {
    if (!this.active) return;
    if (
      e.pointerType === "mouse" &&
      document.pointerLockElement === this.canvas
    ) {
      const sensitivity = this.mouseAim ? 0.0018 : 0.0027;
      this.frame.yaw += e.movementX * sensitivity;
      this.frame.pitch = Math.max(
        -0.85,
        Math.min(0.85, this.frame.pitch + e.movementY * sensitivity),
      );
    } else if (
      e.pointerType === "mouse" &&
      this.mouseAim &&
      this.mousePosition
    ) {
      this.frame.yaw += (e.clientX - this.mousePosition.x) * 0.0018;
      this.frame.pitch = Math.max(
        -0.85,
        Math.min(
          0.85,
          this.frame.pitch + (e.clientY - this.mousePosition.y) * 0.0018,
        ),
      );
      this.mousePosition = { x: e.clientX, y: e.clientY };
    } else if (this.touchLook?.id === e.pointerId) {
      this.frame.yaw += (e.clientX - this.touchLook.x) * 0.006;
      this.frame.pitch = Math.max(
        -0.85,
        Math.min(
          0.85,
          this.frame.pitch + (e.clientY - this.touchLook.y) * 0.004,
        ),
      );
      this.touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  };
  private up = (e: PointerEvent) => {
    if (this.touchLook?.id === e.pointerId) this.touchLook = undefined;
  };
  private mouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseAttack = false;
    if (e.button === 2) {
      this.mouseAim = false;
      this.mousePosition = undefined;
    }
  };
  peek(): InputFrame {
    return {
      ...this.frame,
      attack: this.frame.attack || this.mouseAttack,
      aim: this.frame.aim || this.mouseAim,
    };
  }
  pressAttack(): void {
    this.attackPress = true;
  }
  cancelAttack(): void {
    this.attackPress = false;
  }
  sample(): InputFrame {
    const f = { ...this.frame, move: { ...this.frame.move }, seq: ++this.seq };
    if (this.keys.size)
      f.move = {
        x: (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
        z: (this.keys.has("KeyS") ? 1 : 0) - (this.keys.has("KeyW") ? 1 : 0),
      };
    f.attack = f.attack || this.mouseAttack || this.attackPress;
    this.attackPress = false;
    f.aim = f.aim || this.mouseAim;
    if (f.aim) f.aimOrigin = this.aimOrigin?.();
    f.jump = f.jump || this.keys.has("Space");
    f.sprint = f.sprint || this.keys.has("ShiftLeft");
    return f;
  }
  releaseAll = () => {
    this.keys.clear();
    this.frame.move = { x: 0, z: 0 };
    this.frame.attack = false;
    this.frame.aim = false;
    this.frame.jump = false;
    this.frame.sprint = false;
    this.mouseAttack = false;
    this.mouseAim = false;
    this.attackPress = false;
    this.mousePosition = undefined;
    delete this.frame.aimOrigin;
    this.touchLook = undefined;
  };
  synchronize(seq: number, yaw?: number): void {
    this.seq = Math.max(this.seq, seq);
    if (yaw !== undefined) this.frame.yaw = yaw;
  }
  dispose(): void {
    this.releaseAll();
    window.removeEventListener("keydown", this.keydown);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.releaseAll);
    document.removeEventListener("pointerlockchange", this.lock);
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("mousedown", this.mouseDown);
    window.removeEventListener("mouseup", this.mouseUp);
    this.canvas.removeEventListener("pointermove", this.move);
    window.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.releaseAll);
    this.canvas.removeEventListener("contextmenu", this.context);
  }
}
