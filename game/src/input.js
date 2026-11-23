// Neon Palms — keyboard + mouse input, with world-space mouse for aiming.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0; this.mouseY = 0;
    this.mouseWorldX = 0; this.mouseWorldY = 0;
    this.mouseDown = false; this.clicked = false;
    this.camX = 0; this.camY = 0;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this._pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    this._pressed = new Set();
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
      this.updateMouseWorld();
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouseDown = true; this.clicked = true; } });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this._pressed.has(code); }
  endFrame() { this._pressed.clear(); this.clicked = false; }
  setCamera(x, y) { this.camX = x; this.camY = y; this.updateMouseWorld(); }
  updateMouseWorld() {
    this.mouseWorldX = this.camX + this.mouseX;
    this.mouseWorldY = this.camY + this.mouseY;
  }
}
