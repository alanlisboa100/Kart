// KARTOPIA - input: analog touch joystick (left thumb) + action buttons (right),
// plus full keyboard support. Exposes { throttle, brake, steer, drift } and a
// one-shot "use item" poll. Steer is a continuous axis in [-1, 1].

export class Input {
  constructor() {
    this.keys = {};
    // button states (gas/brake/drift come from on-screen buttons or keys)
    this.btn = { gas: false, brake: false, drift: false };
    this._useQueued = false;

    // Joystick state
    this.joy = {
      active: false,
      id: null,        // touch identifier currently controlling the stick
      cx: 0, cy: 0,    // base center (px)
      x: 0,            // normalized -1..1 horizontal
      radius: 60,      // px travel for full deflection
    };

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (down && (k === 'e' || k === 'enter' || k === 'control')) this.queueUse();
    this.keys[k] = down;
  }

  queueUse() { this._useQueued = true; }
  pollUse() { const v = this._useQueued; this._useQueued = false; return v; }

  // ---- Joystick binding ----
  // base: the element acting as the joystick zone; knob: the moving thumb dot.
  bindJoystick(base, knob) {
    this.joyBase = base;
    this.joyKnob = knob;

    const start = (clientX, clientY, id) => {
      const rect = base.getBoundingClientRect();
      // center the stick wherever the thumb lands inside the zone
      this.joy.active = true;
      this.joy.id = id;
      this.joy.cx = clientX;
      this.joy.cy = clientY;
      this.joy.radius = Math.max(46, Math.min(rect.width, rect.height) * 0.42);
      this._moveKnob(0, 0);
      base.classList.add('active');
    };
    const move = (clientX, clientY) => {
      if (!this.joy.active) return;
      let dx = clientX - this.joy.cx;
      let dy = clientY - this.joy.cy;
      const r = this.joy.radius;
      const len = Math.hypot(dx, dy);
      if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
      this.joy.x = dx / r; // -1..1
      this._moveKnob(dx, dy);
    };
    const end = () => {
      this.joy.active = false;
      this.joy.id = null;
      this.joy.x = 0;
      this._moveKnob(0, 0);
      base.classList.remove('active');
    };

    base.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      start(t.clientX, t.clientY, t.identifier);
    }, { passive: false });
    base.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { e.preventDefault(); move(t.clientX, t.clientY); }
      }
    }, { passive: false });
    const touchEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.joy.id) { e.preventDefault(); end(); }
    };
    base.addEventListener('touchend', touchEnd, { passive: false });
    base.addEventListener('touchcancel', touchEnd, { passive: false });

    // Mouse (desktop testing)
    base.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY, 'mouse'); });
    window.addEventListener('mousemove', (e) => { if (this.joy.id === 'mouse') move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (this.joy.id === 'mouse') end(); });
  }

  _moveKnob(dx, dy) {
    if (this.joyKnob) this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // ---- Action buttons (gas/brake/drift/item) ----
  bindButtons(root) {
    root.querySelectorAll('[data-btn]').forEach((el) => {
      const name = el.dataset.btn;
      if (name === 'item') {
        const press = (e) => { e.preventDefault(); this.queueUse(); el.classList.add('on'); };
        const rel = () => el.classList.remove('on');
        el.addEventListener('touchstart', press, { passive: false });
        el.addEventListener('touchend', (e) => { e.preventDefault(); rel(); }, { passive: false });
        el.addEventListener('mousedown', press);
        el.addEventListener('mouseup', rel);
        el.addEventListener('mouseleave', rel);
        return;
      }
      if (!(name in this.btn)) return;
      const set = (v) => (e) => { e.preventDefault(); this.btn[name] = v; el.classList.toggle('on', v); };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false), { passive: false });
      el.addEventListener('touchcancel', set(false), { passive: false });
      el.addEventListener('mousedown', set(true));
      el.addEventListener('mouseup', set(false));
      el.addEventListener('mouseleave', set(false));
    });
  }

  reset() {
    for (const k in this.btn) this.btn[k] = false;
    this._useQueued = false;
    this.joy.active = false; this.joy.id = null; this.joy.x = 0;
    this._moveKnob(0, 0);
    if (this.joyBase) this.joyBase.classList.remove('active');
  }

  get state() {
    const k = this.keys;
    const up = k['arrowup'] || k['w'] || this.btn.gas;
    const down = k['arrowdown'] || k['s'] || this.btn.brake;
    const kbSteer = (k['arrowright'] || k['d'] ? 1 : 0) - (k['arrowleft'] || k['a'] ? 1 : 0);
    const drift = k[' '] || k['shift'] || this.btn.drift;

    // Joystick takes priority when engaged; otherwise keyboard.
    let steer = this.joy.active ? this.joy.x : kbSteer;
    // small dead-zone for comfort
    if (Math.abs(steer) < 0.06) steer = 0;

    return {
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
      steer,
      drift: !!drift,
    };
  }
}
