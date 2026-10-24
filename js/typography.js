/**
 * The title stays a real <h1> in the DOM. This module rasterizes it so the
 * liquid shader can displace the same glyphs, and keeps both layers aligned.
 */
export class TitleRaster {
  constructor(titleElement) {
    this.title = titleElement;
    this.chars = Array.from(titleElement.querySelectorAll(".char"));
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    this.ready = false;
  }

  async loadFonts() {
    if (!document.fonts) return;
    try {
      await document.fonts.load('400 100px "Pirata One"');
      await document.fonts.ready;
    } catch {
      /* the fallback stack still renders */
    }
    this.ready = true;
  }

  rasterize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);

    const ctx = this.ctx;
    const style = window.getComputedStyle(this.title);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const char of this.chars) {
      if (char.classList.contains("char--space")) continue;

      const rect = char.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;

      const fontSize = Number.parseFloat(window.getComputedStyle(char).fontSize) || 96;
      ctx.font = `400 ${fontSize}px ${style.fontFamily}`;
      ctx.fillText(
        char.textContent.trim(),
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
    }

    return this.canvas;
  }

  bounds() {
    return this.title.getBoundingClientRect();
  }
}
