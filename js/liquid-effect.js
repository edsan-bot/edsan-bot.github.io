import * as THREE from "three";

const shaderUrl = (name) => new URL(`../shaders/${name}`, import.meta.url).href;

async function loadShader(name) {
  const response = await fetch(shaderUrl(name));
  if (!response.ok) throw new Error(`No se pudo cargar shaders/${name} (${response.status})`);
  return response.text();
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Liquid stage: a single WebGL surface that owns the skull, the ink field
 * and the displaced title. The wave field is a real ping-pong simulation,
 * so every element shares the same physics.
 */
export class LiquidStage {
  constructor(canvas, { skull, coarse = false } = {}) {
    this.canvas = canvas;
    this.skullImage = skull;
    this.coarse = coarse;
    this.simSize = coarse ? 256 : 512;

    this.pointer = new THREE.Vector2(0.5, 0.5);
    this.pointerTarget = new THREE.Vector2(0.5, 0.5);
    this.previousPointer = new THREE.Vector2(0.5, 0.5);

    this.scroll = 0;
    this.energy = 0;
    this.entrance = 0;
    this.time = 0;
    this.textMix = 0;
    this.frag = 0;
    this.clickImpulse = 0;
    this.focusAmount = 0;
    this.focusRect = new THREE.Vector4(0, 0, 0, 0);
    this.focusTarget = 0;

    this.running = false;
    this.disposed = false;
    this.lastFrame = 0;
    this.textReady = false;

    this.onReducedMotionChange = this.onReducedMotionChange.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.render = this.render.bind(this);
  }

  async init() {
    const [vertex, simFragment, compositeFragment] = await Promise.all([
      loadShader("liquid.vert"),
      loadShader("sim.frag"),
      loadShader("composite.frag"),
    ]);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });

    if (!this.renderer.capabilities.isWebGL2) {
      throw new Error("WebGL2 no disponible");
    }

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.coarse ? 1.5 : 2));

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.scene.add(this.quad);

    this.simScene = new THREE.Scene();
    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.simScene.add(this.simQuad);

    const targetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.targetA = new THREE.WebGLRenderTarget(this.simSize, this.simSize, targetOptions);
    this.targetB = new THREE.WebGLRenderTarget(this.simSize, this.simSize, targetOptions);

    this.simUniforms = {
      uState: { value: null },
      uTexel: { value: new THREE.Vector2(1 / this.simSize, 1 / this.simSize) },
      uPoint: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 },
      uRadius: { value: this.coarse ? 0.16 : 0.11 },
      uStrength: { value: 0 },
      uDamping: { value: 0.994 },
      uClamp: { value: 0.9 },
    };

    this.simMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: simFragment,
      uniforms: this.simUniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeUniforms = {
      uSim: { value: null },
      uSkull: { value: null },
      uText: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: this.simUniforms.uTexel.value },
      uAspect: { value: 1 },
      uTime: { value: 0 },
      uEntrance: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uEnergy: { value: 0 },
      uTextMix: { value: 0 },
      uFrag: { value: 0 },
      uFragOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
      uFocusAmount: { value: 0 },
      uSkullZoom: { value: 1.0 },
      uSkullAspect: { value: 1.5 },
      uGrain: { value: 0.045 },
    };

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: compositeFragment,
      uniforms: this.compositeUniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.quad.material = this.compositeMaterial;

    await this.prepareSkull();
    this.setupText();
    this.resize();

    this.boundResize = this.resizeDebounced.bind(this);
    window.addEventListener("resize", this.boundResize, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibilityChange);

    this.reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.reducedQuery.matches;
    this.reducedQuery.addEventListener("change", this.onReducedMotionChange);

    return this;
  }

  async prepareSkull() {
    const image = this.skullImage;
    if (!image) throw new Error("Falta la imagen del cráneo");

    if (!image.complete) {
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error("No se pudo cargar el cráneo")), {
          once: true,
        });
      });
    }

    if (image.naturalWidth) {
      this.compositeUniforms.uSkullAspect.value = image.naturalWidth / image.naturalHeight;
    }

    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    this.skullTexture = texture;
    this.compositeUniforms.uSkull.value = texture;
  }

  setupText() {
    this.textCanvas = document.createElement("canvas");
    this.textCanvas.width = 1;
    this.textCanvas.height = 1;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;
    this.textTexture.magFilter = THREE.LinearFilter;
    this.textTexture.generateMipmaps = false;
    this.textTexture.colorSpace = THREE.NoColorSpace;
    this.compositeUniforms.uText.value = this.textTexture;
  }

  setTextCanvas(canvas) {
    if (!this.textTexture) return;
    this.compositeUniforms.uText.value = null;
    this.textTexture.dispose();
    this.textTexture = new THREE.CanvasTexture(canvas);
    this.textTexture.minFilter = THREE.LinearFilter;
    this.textTexture.magFilter = THREE.LinearFilter;
    this.textTexture.generateMipmaps = false;
    this.textTexture.colorSpace = THREE.NoColorSpace;
    this.textTexture.needsUpdate = true;
    this.compositeUniforms.uText.value = this.textTexture;
    this.textReady = true;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.coarse ? 1.5 : 2);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.compositeUniforms.uResolution.value.set(width, height);
    this.compositeUniforms.uAspect.value = width / Math.max(height, 1);
    this.simUniforms.uAspect.value = width / Math.max(height, 1);

    if (!this.running) this.renderOnce();
  }

  resizeDebounced() {
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 120);
  }

  onReducedMotionChange() {
    if (this.reducedQuery.matches) {
      this.stop();
      this.renderOnce();
    } else {
      this.start();
    }
  }

  onVisibilityChange() {
    if (document.hidden) this.stop();
    else if (!this.reducedQuery?.matches) this.start();
  }

  movePointer(x, y) {
    this.pointerTarget.set(x, y);
  }

  click(x, y) {
    this.pointerTarget.set(x, y);
    this.pointer.copy(this.pointerTarget);
    this.clickImpulse = 0.3;
    this.simUniforms.uRadius.value = this.coarse ? 0.2 : 0.15;
    window.setTimeout(() => {
      this.simUniforms.uRadius.value = this.coarse ? 0.16 : 0.11;
    }, 260);
  }

  setScroll(value) {
    this.scroll = clamp(value, 0, 1);
  }

  setTextMix(value) {
    this.textMix = clamp(value, 0, 1);
  }

  setFrag(value) {
    this.frag = clamp(value, 0, 1);
  }

  setFocus(rect) {
    if (!rect) {
      this.focusTarget = 0;
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const x = rect.left / width;
    const y = 1 - (rect.top + rect.height) / height;
    const w = rect.width / width;
    const h = rect.height / height;
    this.focusRect.set(x, y, w, h);
    this.focusTarget = 1;
  }

  setFragOrigin(clientX, clientY) {
    this.compositeUniforms.uFragOrigin.value.set(
      clientX / window.innerWidth,
      1 - clientY / window.innerHeight,
    );
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.render);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  renderOnce() {
    if (!this.renderer) return;
    this.update(1 / 60);
    this.drawSim();
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  render(frameTime) {
    if (!this.running) return;
    const now = frameTime || performance.now();
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    this.update(delta);
    this.drawSim();

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);

    this.raf = requestAnimationFrame(this.render);
  }

  update(delta) {
    this.time += delta;

    // Frame-rate independent easing toward the pointer target.
    const ease = 1 - Math.exp(-delta * 16);
    this.pointer.lerp(this.pointerTarget, ease);

    const dx = this.pointer.x - this.previousPointer.x;
    const dy = this.pointer.y - this.previousPointer.y;
    const speed = Math.hypot(dx, dy) / Math.max(delta, 1 / 240);

    this.energy += (clamp(speed * 0.9, 0, 1) - this.energy) * (1 - Math.exp(-delta * 6));
    this.clickImpulse *= Math.exp(-delta * 11);
    if (this.clickImpulse < 0.002) this.clickImpulse = 0;

    this.focusAmount += (this.focusTarget - this.focusAmount) * (1 - Math.exp(-delta * 8));
    if (this.focusTarget === 0 && this.focusAmount < 0.002) this.focusAmount = 0;

    this.entrance += (1 - this.entrance) * (1 - Math.exp(-delta * 1.6));

    this.previousPointer.copy(this.pointer);

    this.simUniforms.uPoint.value.copy(this.pointer);
    this.simUniforms.uStrength.value =
      clamp(speed * 0.14, 0, 0.22) * delta * 60 + this.clickImpulse;
    // Damping is per frame, so it has to be normalised to 60 Hz or ripples
    // die 2.4x faster on a 144 Hz display.
    this.simUniforms.uDamping.value = this.reducedMotion ? 0.9 : Math.pow(0.994, delta * 60);

    this.compositeUniforms.uTime.value = this.time;
    this.compositeUniforms.uEntrance.value = this.entrance;
    this.compositeUniforms.uScroll.value = this.scroll;
    this.compositeUniforms.uMouse.value.set(this.pointer.x, 1 - this.pointer.y);
    this.compositeUniforms.uEnergy.value = this.energy;
    this.compositeUniforms.uTextMix.value = this.textMix;
    this.compositeUniforms.uFrag.value = this.frag;
    this.compositeUniforms.uFocus.value.copy(this.focusRect);
    this.compositeUniforms.uFocusAmount.value = this.focusAmount;
  }

  drawSim() {
    this.simUniforms.uState.value = this.targetA.texture;
    this.simQuad.material = this.simMaterial;
    this.renderer.setRenderTarget(this.targetB);
    this.renderer.render(this.simScene, this.camera);

    const swap = this.targetA;
    this.targetA = this.targetB;
    this.targetB = swap;

    this.compositeUniforms.uSim.value = this.targetA.texture;
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    if (enabled) {
      this.stop();
      this.entrance = 1;
      this.renderOnce();
    } else {
      this.start();
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    window.removeEventListener("resize", this.boundResize);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.reducedQuery?.removeEventListener("change", this.onReducedMotionChange);
    this.targetA?.dispose();
    this.targetB?.dispose();
    this.skullTexture?.dispose();
    this.textTexture?.dispose();
    this.simMaterial?.dispose();
    this.compositeMaterial?.dispose();
    this.quad?.geometry.dispose();
    this.simQuad?.geometry.dispose();
    this.renderer?.dispose();
  }
}
