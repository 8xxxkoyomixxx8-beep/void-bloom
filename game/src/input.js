// Keyboard and mouse state for the Warden: held movement keys, the aim point in field
// coordinates, firing and dashing, plus the one-shot key presses the screens consume (start,
// pause, restart, upgrade picks, mute). The game never reads DOM events anywhere else.

/** The keys that move the Warden, by KeyboardEvent.code, as [axis, direction] pairs. */
const MOVE_KEYS = {
  KeyW: ['y', -1], ArrowUp: ['y', -1],
  KeyS: ['y', 1], ArrowDown: ['y', 1],
  KeyA: ['x', -1], ArrowLeft: ['x', -1],
  KeyD: ['x', 1], ArrowRight: ['x', 1],
};

/** Make the input state bound to a canvas; toField maps client pixels to field coordinates. */
export function makeInput(canvas, toField) {
  const held = new Set();
  const pressed = new Set();
  const input = {
    /** The aim point, in field coordinates. */
    aim: { x: 640, y: 300 },
    /** True while the mouse button or Space is held: the cannon fires. */
    firing: false,
    mouseDown: false,

    /** The movement direction the held keys ask for, each axis in -1, 0 or 1 (not normalised). */
    moveAxis() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const axis = MOVE_KEYS[code];
        if (axis) {
          if (axis[0] === 'x') x += axis[1];
          else y += axis[1];
        }
      }
      return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    },

    /** True while a dash key (Shift or K) is held. */
    dashHeld() {
      return held.has('ShiftLeft') || held.has('ShiftRight') || held.has('KeyK');
    },

    /** Take a one-shot press: true once per physical press of the code since the last take. */
    take(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },

    /** Forget every held and pressed key (on blur, so a lost keyup never sticks a key down). */
    clear() {
      held.clear();
      pressed.clear();
      input.firing = false;
      input.mouseDown = false;
    },
  };

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
    if (event.code === 'Space') input.firing = true;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (event.code === 'Space' && !input.mouseDown) input.firing = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const point = toField(event.clientX, event.clientY);
    input.aim.x = point.x;
    input.aim.y = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    input.mouseDown = true;
    input.firing = true;
    pressed.add('Mouse0');
    const point = toField(event.clientX, event.clientY);
    input.aim.x = point.x;
    input.aim.y = point.y;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;
    input.mouseDown = false;
    if (!held.has('Space')) input.firing = false;
  });
  window.addEventListener('blur', () => input.clear());
  return input;
}
