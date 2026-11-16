import type { Renderer } from '../../external/pbrt/web/src/renderer/renderer';

// One gesture has one meaning: a click picks, a drag moves the rendering camera.
export function renderCameraControls(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  pick: (pixel: number[]) => void,
  changed: () => void,
) {
  let drag:
    | {
        id: number;
        x: number;
        y: number;
        lastX: number;
        lastY: number;
        button: number;
        moved: boolean;
      }
    | undefined;
  const down = (e: PointerEvent) => {
    if (e.button > 2) return;
    canvas.focus({ preventScroll: true });
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      button: e.button,
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    const dx = e.clientX - (drag.moved ? drag.lastX : drag.x);
    const dy = e.clientY - (drag.moved ? drag.lastY : drag.y);
    drag.moved = true;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (drag.button !== 0 || e.shiftKey) renderer.move(-dx * 0.008, dy * 0.008, 0);
    else renderer.orbit(dx, dy);
    changed();
  };
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && drag.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * renderer.width);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * renderer.height);
      if (x >= 0 && y >= 0 && x < renderer.width && y < renderer.height) pick([x, y]);
    }
    drag = undefined;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const cancel = () => {
    drag = undefined;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    renderer.move(0, 0, Math.max(-0.5, Math.min(0.5, -e.deltaY * 0.002)));
    changed();
  };
  const context = (e: Event) => e.preventDefault();
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', context);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('lostpointercapture', cancel);
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('contextmenu', context);
  };
}
