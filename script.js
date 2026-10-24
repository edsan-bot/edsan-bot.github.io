import { LiquidStage } from "./js/liquid-effect.js";
import { TitleRaster } from "./js/typography.js";
import { Interactions } from "./js/interactions.js";
import { initReveals, afterEntrance } from "./js/animations.js";

const root = document.documentElement;

function enableFallback(reason) {
  if (reason) console.warn("[liquid gothic] modo estático:", reason);
  root.classList.remove("webgl");
  root.classList.add("no-webgl");
  document
    .querySelectorAll(".gallery__item, .gallery__head, .colophon")
    .forEach((element) => element.classList.add("is-in"));
}

async function boot() {
  const canvas = document.getElementById("stage");
  const skull = document.getElementById("skull-source");
  const title = document.querySelector(".hero__title");
  const cursor = document.getElementById("cursor");

  if (!canvas || !title) return;

  root.classList.add("js");
  initReveals();

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const raster = new TitleRaster(title);
  await raster.loadFonts();

  const stage = new LiquidStage(canvas, { skull, coarse });
  await stage.init();
  stage.reducedMotion = reduced;

  root.classList.add("webgl");

  const interactions = new Interactions({ stage, title, cursor });
  interactions.reduced = reduced;
  interactions.start();

  const paintTitle = () => {
    if (!document.body.contains(title)) return;
    stage.setTextCanvas(raster.rasterize());
  };

  // The glyphs are only measurable once the CSS entrance stops transforming them.
  afterEntrance(() => {
    paintTitle();
    title.classList.add("is-settled");
  });

  let resizeTimer;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(paintTitle, 280);
    },
    { passive: true },
  );

  if (reduced) {
    stage.entrance = 1;
    stage.renderOnce();
    stage.renderOnce();
  } else {
    stage.start();
  }

  // Dev aid: `?debug=interact` freezes the interactive title state for visual checks.
  const params = new URLSearchParams(window.location.search);
  const debug = params.get("debug");
  if (debug === "textonly") {
    stage.setTextMix(1);
    stage.entrance = 1;
    title.style.opacity = "0";
  }
  if (debug === "interact" || debug === "frag") {
    const rect = title.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    stage.movePointer(x / window.innerWidth, y / window.innerHeight);
    stage.pointer.set(x / window.innerWidth, y / window.innerHeight);
    stage.setTextMix(1);
    stage.entrance = 1;
    title.style.opacity = "0.14";
    if (debug === "frag") {
      stage.setFragOrigin(x, y);
      stage.setFrag(1);
    }
    if (!reduced) stage.start();
  }
}

boot().catch((error) => enableFallback(error?.message || error));
