import { useRef, useState } from "react";
import type { InputController } from "../input/controller";
export function TouchControls({
  controller,
  action,
}: {
  controller?: InputController;
  action: (name: string) => void;
}) {
  const stick = useRef<{ id: number; x: number; y: number } | undefined>(
      undefined,
    ),
    [offset, setOffset] = useState({ x: 0, y: 0 });
  const held = useRef<Partial<Record<"attack" | "aim" | "jump", number>>>({});
  const releaseStick = (e: React.PointerEvent) => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = undefined;
    setOffset({ x: 0, y: 0 });
    if (controller) controller.frame.move = { x: 0, z: 0 };
  };
  const hold = (key: "attack" | "aim" | "jump") => {
    const release = (e: React.PointerEvent) => {
      if (held.current[key] !== e.pointerId) return;
      delete held.current[key];
      if (controller) controller.frame[key] = false;
      if (key === "attack" && e.type !== "pointerup")
        controller?.cancelAttack();
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        if (held.current[key] !== undefined) return;
        held.current[key] = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (controller) controller.frame[key] = true;
        if (key === "attack") controller?.pressAttack();
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
    };
  };
  return (
    <div className="touch-controls">
      <div
        className="joystick"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          e.preventDefault();
          if (stick.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const s = stick.current;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x,
            dy = e.clientY - s.y,
            len = Math.max(35, Math.hypot(dx, dy)),
            x = dx / len,
            y = dy / len;
          setOffset({ x: x * 35, y: y * 35 });
          if (controller) controller.frame.move = { x, z: y };
        }}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        onLostPointerCapture={releaseStick}
      >
        <span style={{ transform: `translate(${offset.x}px,${offset.y}px)` }} />
      </div>
      <div className="touch-actions">
        <button {...hold("aim")} aria-label="Aim or block">
          Aim
        </button>
        <button
          {...hold("attack")}
          className="touch-attack"
          aria-label="Attack"
        >
          Attack
        </button>
        <button {...hold("jump")} aria-label="Jump">
          Jump
        </button>
        <button onClick={() => action("interact")} aria-label="Interact">
          Use
        </button>
        <button
          onClick={() => {
            if (controller)
              controller.frame.weaponSlot =
                controller.frame.weaponSlot === 0 ? 1 : 0;
          }}
          aria-label="Switch weapon"
        >
          Switch
        </button>
        <button onClick={() => action("eat")} aria-label="Eat food">
          Eat
        </button>
      </div>
    </div>
  );
}
