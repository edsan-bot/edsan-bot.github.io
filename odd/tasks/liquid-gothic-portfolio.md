# Liquid Gothic Portfolio — Santiago Cabrera

Objective: rebuild the portfolio as an interactive monochrome exhibition (WebGL liquid distortion, blackletter identity, gothic skull).
Branch: `feat/liquid-gothic` · Delivery: work-unit commits, single PR at the end · Runner: static site (no build), verified with Chrome headless + `python -m http.server`.

## Specs

S1. Monochrome palette only: `#050505`, `#111111`, `#FFFFFF`, `#E5E5E5`, `#858585`, `#292929`. No saturated colors, no neon green.
S2. Display type is a contemporary blackletter family, white, protagonist, legible. Self-hosted `Pirata One` (OFL).
S3. Display type is never static: cinematic reveal from darkness, liquid distortion near the cursor, drifting white/grey edge offsets, letter fragmentation on click, progressive reconstruction, waves crossing the text. Legibility is preserved at all times.
S4. Gothic skull integrated in the background, emerging from darkness, partially hidden, affected by the liquid distortion and by cursor-driven lighting. Not a pasted decorative image. Source: CC BY 2.0 photo, credited.
S5. Liquid distortion is a real WebGL/GLSL effect (wave simulation), not CSS filters: cursor motion produces organic waves, speed changes intensity, waves expand and blend, click produces a stronger burst, the surface recovers.
S6. The same effect reaches the title, the skull and the project cards — one coherent visual system.
S7. Custom cursor: small, non-intrusive, changes near interactive elements, click burst; touch events adapted; conventional cursor/accessibility preserved.
S8. Page structure: hero with name, subtitle `PORTAFOLIO / CÓDIGO CREATIVO`, skull, liquid field, scroll indicator; project gallery; small editorial indicators.
S9. Projects preserved exactly, with their URLs:
   - `01 — Pelota que rebota` → `https://edsan-bot.github.io/pelota-que-rebota/`
   - `02 — Interacción con las manos` → `https://edsan-bot.github.io/Interaccion_manos/`
   - `03 — Proyecto 3` → URL pending
   - `04 — Proyecto 4` → URL pending
   The two live ones open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`. Pending ones are not links.
S10. Editorial indicators allowed: `SANTIAGO CABRERA`, `CREATIVE CODING`, `DIGITAL EXPERIMENTS`, `CUENCA / ECUADOR`. No invented personal data.
S11. Coordinated motion with a real rest state vs interaction state. Not everything moves permanently.
S12. Stack: HTML5, CSS3, modern JS, WebGL, GLSL, Three.js. No heavy framework, no GIF/video faking the effect.
S13. Modular architecture: `js/liquid-effect.js`, `js/interactions.js`, `js/typography.js`, `js/animations.js`, `shaders/`, `assets/`.
S14. Responsive: full experience on desktop; reduced complexity on mobile; battery-conscious.
S15. Performance: one renderer, one canvas, controlled canvas size, cleaned resources, no navigation blocking.
S16. Accessibility: semantic HTML, real links, keyboard navigation, visible focus, sufficient contrast, `prefers-reduced-motion` respected, visual alternative when WebGL is unavailable.

## Tasks

| ID | Scope | Specs | Route | Status |
|----|-------|-------|-------|--------|
| T1 | Assets + credits + gitignore + task doc | S4, S2 | inline | done |
| T2 | Semantic HTML shell, hero, gallery, colophon | S8, S9, S10, S16 | inline | done |
| T3 | Stylesheet: tokens, blackletter scale, layout, cards, responsive | S1, S2, S8, S14 | inline | done |
| T4 | Liquid engine: simulation + composite shaders, skull integration | S4, S5, S6, S15 | inline | done |
| T5 | Typography engine: raster, distortion, fragmentation, reveal | S3, S6 | inline | done |
| T6 | Interactions: cursor, ripples, card focus, scroll, gallery | S7, S11 | inline | done |
| T7 | Fallback + reduced motion + performance guards | S14, S15, S16 | inline | done |
| T8 | Verification: headless screenshots, console, links, responsive | all | inline | done |

## Log

L1 (verbatim request, 2026-10-23): "Propon y desarrolla lo mejor para este proyecto, si tienes que buscar bien en cada repositorio haz y te doy luz verde para que tomes buenas decisiones para cada una que tengamos que hacer."

L2 Decision — skull asset: `Catacombs of Paris December 27, 2010` by Richard Munckton, CC BY 2.0, 3872×2581, via Wikimedia Commons. Chosen because a single skull emerges from a near-black background (clean composite, no image edges), with weathered texture and deep shadows. Resized to 1600/800 px. Attribution in `assets/CREDITS.md` and in the page colophon.

L3 Decision — typography: self-hosted `Pirata One` (OFL, 8.8 KB woff2) instead of the Google Fonts CDN: no third-party request, no render-blocking `@import`, offline-safe. Body and micro-labels use the system sans/mono stacks (zero payload).

L4 Decision — text distortion: the real `<h1>` stays in the DOM (selectable, SEO, screen readers). It is rasterized to a texture and the same liquid shader renders a displaced copy that fades in with interaction, while the crisp layer dims. Rest state is always perfectly legible (S3, S16).

L5 Decision — no GSAP: the motion budget is CSS transitions plus one rAF timeline; a dependency would add weight without value.

L6 Decision — Three.js pinned `0.169.0` via import map; the page degrades to a static composition if the module or WebGL fails.

L7 Verification (2026-10-24):
- Engine boots with a clean console (no errors/warnings) in headless Chrome/SwiftShader at 1440×900 and 390×844.
- Rest state: title crisp, skull sunk into black, gallery cards readable.
- Wave state (synthetic pointer path 4×4 moves): title displaces and returns, legibility preserved; soft saturation caps displacement so no glyph is destroyed.
- Hover on a card: focus rect feeds extra refraction + ink inside the row, cursor ring grows, rule and gradient respond.
- Keyboard: Tab reaches the skip link and the scroll cue with a visible 1px outline.
- `prefers-reduced-motion: reduce`: one static frame, CSS entrance neutralised, custom cursor hidden, no rAF loop.
- WebGL unavailable (CDN blocked): `.no-webgl` fallback renders the CSS skull + scrim, all projects visible, no console errors.
- Assets: `skull-1600.jpg` 128 KB, `skull-800.jpg` 44 KB, `pirata-one-latin.woff2` 8.8 KB.
- Project URLs re-checked: `/pelota-que-rebota/` 200, `/Interaccion_manos/` 200.

L8 Known limitation: the site uses ES modules, so it must be served over HTTP (`npx serve`, GitHub Pages). Opening `index.html` from the filesystem shows the static fallback only.

L9 Risk: item 3 (contracts others consume) is not touched — the project URLs and names are unchanged. Item 5 (delivery/environment): this is a full rewrite of the published `main` site, deployed by GitHub Pages on merge. No migrations, no stored data, no credentials.

