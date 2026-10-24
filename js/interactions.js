const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Pointer, touch, cursor, cards and scroll — everything that feeds the stage. */
export class Interactions {
  constructor({ stage, title, cursor }) {
    this.stage = stage;
    this.title = title;
    this.cursor = cursor;

    this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.cursorPos = { ...this.pointer };
    this.finePointer = window.matchMedia("(pointer: fine)").matches;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.titleRect = null;
    this.titleDirty = true;
    this.running = false;
    this.fragValue = 0;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    this.frame = this.frame.bind(this);
  }

  start() {
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onResize, { passive: true });

    this.bindCards();

    if (this.finePointer && !this.reduced) {
      document.documentElement.classList.add("has-custom-cursor");
    }

    this.onScroll();
    this.updateTitleRect();
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  bindCards() {
    this.cards = Array.from(document.querySelectorAll(".card:not(.is-pending)"));

    for (const card of this.cards) {
      card.addEventListener("pointerenter", () => {
        this.stage.setFocus(card.getBoundingClientRect());
        this.setCursorActive(true);
      });
      card.addEventListener("pointerleave", () => {
        this.stage.setFocus(null);
        this.setCursorActive(false);
      });
      card.addEventListener("focus", () => {
        this.stage.setFocus(card.getBoundingClientRect());
        this.setCursorActive(true);
      });
      card.addEventListener("blur", () => {
        this.stage.setFocus(null);
        this.setCursorActive(false);
      });
    }

    document.querySelectorAll(".scroll-cue, .colophon__credit a").forEach((link) => {
      link.addEventListener("pointerenter", () => this.setCursorActive(true));
      link.addEventListener("pointerleave", () => this.setCursorActive(false));
    });
  }

  setCursorActive(active) {
    this.cursor?.classList.toggle("is-active", active);
  }

  onPointerMove(event) {
    const x = event.clientX;
    const y = event.clientY;

    this.pointer.x = x;
    this.pointer.y = y;

    this.stage.movePointer(x / window.innerWidth, y / window.innerHeight);

    if (event.pointerType === "mouse") {
      this.cursor?.classList.add("is-visible");
    }

    if (this.titleDirty) this.updateTitleRect();
    this.updateTextMix(x, y);
  }

  onPointerDown(event) {
    if (this.reduced) return;

    const x = event.clientX ?? this.pointer.x;
    const y = event.clientY ?? this.pointer.y;

    this.stage.click(x / window.innerWidth, y / window.innerHeight);
    this.stage.setFragOrigin(x, y);
    this.fragValue = 1;
    this.stage.setFrag(1);
    this.updateTextMix(x, y);
  }

  updateTextMix(x, y) {
    if (this.reduced || !this.stage.textReady) {
      this.stage.setTextMix(0);
      this.title.style.opacity = "1";
      return;
    }

    const rect = this.titleRect || this.updateTitleRect();
    if (!rect) {
      this.stage.setTextMix(0);
      return;
    }

    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    const reach = Math.max(rect.width * 0.22, 160);
    const proximity = clamp(1 - distance / reach, 0, 1);

    // Crossfade: the crisp DOM layer hands over to the displaced copy
    // before the waves can make the two layers visibly disagree.
    const canvasMix = clamp((proximity - 0.1) / 0.4, 0, 1);
    const domOpacity = 1 - clamp((proximity - 0.02) / 0.3, 0, 1) * 0.92;

    this.stage.setTextMix(canvasMix);
    this.title.style.opacity = String(domOpacity);
  }

  updateTitleRect() {
    const rect = this.title.getBoundingClientRect();
    this.titleRect = rect;
    this.titleDirty = false;
    return rect;
  }

  onScroll() {
    if (this.scrollScheduled) return;
    this.scrollScheduled = true;

    requestAnimationFrame(() => {
      this.scrollScheduled = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      this.stage.setScroll(progress);
      this.titleDirty = true;
      document.body.classList.toggle("is-scrolled", window.scrollY > 48);
    });
  }

  onResize() {
    this.titleDirty = true;
    this.updateTitleRect();
  }

  frame() {
    if (!this.running) return;
    const delta = 1 / 60;

    // Cursor easing: the ring trails the native pointer slightly.
    this.cursorPos.x += (this.pointer.x - this.cursorPos.x) * 0.22;
    this.cursorPos.y += (this.pointer.y - this.cursorPos.y) * 0.22;

    if (this.cursor) {
      this.cursor.style.transform = `translate3d(${this.cursorPos.x}px, ${this.cursorPos.y}px, 0)`;
    }

    if (this.fragValue > 0.001) {
      this.fragValue *= 0.94;
      this.stage.setFrag(this.fragValue);
    } else if (this.fragValue !== 0) {
      this.fragValue = 0;
      this.stage.setFrag(0);
    }

    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onResize);
  }
}
