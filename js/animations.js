/** Scroll reveals, entrance timing and small motion helpers. */

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initReveals() {
  const targets = document.querySelectorAll(
    ".gallery__head, .gallery__item, .colophon",
  );

  if (reducedMotion() || !("IntersectionObserver" in window)) {
    targets.forEach((element) => element.classList.add("is-in"));
    return null;
  }

  document.documentElement.classList.add("reveal-ready");

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
  );

  targets.forEach((element) => observer.observe(element));
  return observer;
}

/** Resolves once the CSS entrance has settled (or immediately if motion is reduced). */
export function afterEntrance(callback) {
  const delay = reducedMotion() ? 80 : 2900;
  window.setTimeout(callback, delay);
}
