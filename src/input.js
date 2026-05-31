// KARTOPIA - input: unifies keyboard (desktop) and on-screen touch buttons.
// Exposes a control state { throttle, brake, steer, drift } plus a one-shot
// "use item" poll.

export class Input {
  constructor() {
    this.keys = {};
    this.touch = { gas: false, brake: false, left: false, right: false, drift: false };
    this._useQueued = false;

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    // one-shot: use item
    if (down && (k === 'e' || k === 'enter' || k === 'control')) this.queueUse();
    this.keys[k] = down;
  }

  queueUse() { this._useQueued = true; }
  pollUse() { const v = this._useQueued; this._useQueued = false; return v; }

  // Bind on-screen buttons (elements with data-btn attributes).
  bindButtons(root) {
    root.querySelectorAll('[data-btn]').forEach((el) => {
      const name = el.dataset.btn;
      if (name === 'item') {
        const press = (e) => { e.preventDefault(); this.queueUse(); };
        el.addEventListener('touchstart', press, { passive: false });
        el.addEventListener('mousedown', press);
        return;
      }
      if (!(name in this.touch)) return;
      const set = (v) => (e) => { e.preventDefault(); this.touch[name] = v; };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false), { passive: false });
      el.addEventListener('touchcancel', set(false), { passive: false });
      el.addEventListener('mousedown', set(true));
      el.addEventListener('mouseup', set(false));
      el.addEventListener('mouseleave', set(false));
    });
  }

  reset() {
    for (const k in this.touch) this.touch[k] = false;
    this._useQueued = false;
  }

  get state() {
    const k = this.keys;
    const t = this.touch;
    const up = k['arrowup'] || k['w'] || t.gas;
    const down = k['arrowdown'] || k['s'] || t.brake;
    const left = k['arrowleft'] || k['a'] || t.left;
    const right = k['arrowright'] || k['d'] || t.right;
    const drift = k[' '] || k['shift'] || t.drift;

    return {
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      drift: !!drift,
    };
  }
}
