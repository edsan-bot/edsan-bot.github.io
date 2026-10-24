# Santiago Cabrera — Liquid Gothic Portfolio

Interactive monochrome exhibition for creative-coding work. One WebGL surface owns the
background, the skull and the displaced title, so every element reacts to the same wave field.

## Stack

- HTML, CSS, modern JavaScript (ES modules)
- Three.js `0.169.0` (pinned, import map, CDN)
- Custom GLSL: a ping-pong wave simulation plus a composite pass

## Structure

```
index.html            Semantic shell: cover, gallery, colophon
style.css             Design tokens, blackletter scale, layout, motion
script.js             Boot: raster, engine, interactions, fallback
js/liquid-effect.js   Renderer, simulation, textures, resize, lifecycle
js/typography.js      Rasterizes the live <h1> for the shader
js/interactions.js    Pointer, touch, cursor, cards, scroll
js/animations.js      Scroll reveals and entrance timing
shaders/liquid.vert   Fullscreen quad
shaders/sim.frag      Wave equation (.r current, .g previous)
shaders/composite.frag  Skull + ink + title, one pass
assets/               Skull image, self-hosted font, credits
odd/tasks/            Delivery log for this build
```

## Run locally

ES modules and `fetch` of the shaders need HTTP:

```bash
npx serve .
# or
python -m http.server 8787
```

Opening `index.html` from the filesystem shows the static fallback only.

## Behaviour

- **Rest** — crisp DOM title, still surface.
- **Pointer** — ripples, refraction, lighting shift on the skull.
- **Near the title** — the crisp layer hands over to the displaced copy.
- **Click** — burst wave plus letter fragmentation that reassembles.
- **`prefers-reduced-motion`** — one static frame, no loop, no custom cursor.
- **No WebGL / no CDN** — `.no-webgl` fallback: CSS skull with scrim, all links working.

Dev aids: `?debug=interact`, `?debug=frag`, `?debug=textonly`.

## Credits

Image and font licenses are documented in [`assets/CREDITS.md`](assets/CREDITS.md).
Photograph: *Catacombs of Paris* by Richard Munckton, CC BY 2.0.
Typeface: Pirata One, SIL Open Font License 1.1.
