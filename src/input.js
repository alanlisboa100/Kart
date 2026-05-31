// KARTOPIA - input: FLOATING analog joystick (touch anywhere on the left half
// of the screen and the stick spawns under your thumb) + action buttons on the
// right + full keyboard support.
// Exposes { throttle, brake, steer, drift } and a one-shot "use item" poll.

export class Input {
  constructor() {
    this.keys = {};
    this.btn = { gas: false, brake: false, drift: false };
    this._useQueued = false;

    this.joy = {
      active: false,
      id: null,        // touch identifier controlling the stick
      ox: 0, oy: 0,    // origin (where the thumb first touched)
      x: 0,            // normalized -1..1 horizontal
      radius: 60,      // px travel for full deflection
    };
    this.joyBase = null;   // the visual ring element (moved to the touch origin)
    this.joyKnob = null;

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

  // zone: a full-height element covering the LEFT half of the screen (capture area)
  // base: the visual joystick ring (absolutely positioned, moved to thumb)
  // knob: the moving thumb dot inside base
  bindJoystick(zone, base, knob) {
    this.joyZone = zone;
    this.joyBase = base;
    this.joyKnob = knob;

    const radiusFor = () => Math.max(50, Math.min(window.innerWidth, window.innerHeight) * 0.13);

    const start = (clientX, clientY, id) => {
      this.joy.active = true;
      this.joy.id = id;
      this.joy.ox = clientX;
      this.joy.oy = clientY;
      this.joy.radius = radiusFor();
      // Show & position the ring at the touch point.
      base.style.left = clientX + 'px';
      base.style.top = clientY + 'px';
      base.classList.add('active');
      this._moveKnob(0, 0);
    };
    const move = (clientX, clientY) => {
      if (!this.joy.active) return;
      let dx = clientX - this.joy.ox;
      let dy = clientY - this.joy.oy;
      const r = this.joy.radius;
      const len = Math.hypot(dx, dy);
      if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
      this.joy.x = dx / r;
      this._moveKnob(dx, dy);
    };
    const end = () => {
      this.joy.active = false;
      this.joy.id = null;
      this.joy.x = 0;
      base.classList.remove('active');
      this._moveKnob(0, 0);
    };

    zone.addEventListener('touchstart', (e) => {
      if (this.joy.active) return;
      const t = e.changedTouches[0];
      e.preventDefault();
      start(t.clientX, t.clientY, t.identifier);
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { e.preventDefault(); move(t.clientX, t.clientY); }
      }
    }, { passive: false });
    const tEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.joy.id) { e.preventDefault(); end(); }
    };
    zone.addEventListener('touchend', tEnd, { passive: false });
    zone.addEventListener('touchcancel', tEnd, { passive: false });

    // Mouse (desktop testing)
    zone.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY, 'mouse'); });
    window.addEventListener('mousemove', (e) => { if (this.joy.id === 'mouse') move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (this.joy.id === 'mouse') end(); });
  }

  _moveKnob(dx, dy) {
    if (this.joyKnob) this.joyKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
  }

  // Action buttons (gas/brake/drift/item)
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
    if (this.joyBase) this.joyBase.classList.remove('active');
    this._moveKnob(0, 0);
  }

  get state() {
    const k = this.keys;
    const up = k['arrowup'] || k['w'] || this.btn.gas;
    const down = k['arrowdown'] || k['s'] || this.btn.brake;
    const kbSteer = (k['arrowright'] || k['d'] ? 1 : 0) - (k['arrowleft'] || k['a'] ? 1 : 0);
    const drift = k[' '] || k['shift'] || this.btn.drift;

    let steer = this.joy.active ? this.joy.x : kbSteer;
    if (Math.abs(steer) < 0.06) steer = 0; // dead-zone

    return {
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
      // NOTE: the chase camera looks along +Z, which mirrors world X on screen.
      // Negate so that pushing the stick RIGHT turns the kart RIGHT on screen.
      steer: -steer,
      drift: !!drift,
    };
  }
}
