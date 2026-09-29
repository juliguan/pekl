// PEKL — smooth scroll (Lenis), scroll-choreografie van de 3D-fles (GSAP) en aanmelden.
import { createStage } from "./bottle.js";

// Zet hier de endpoint van je mailinglijst (bijv. Formspree: https://formspree.io/f/xxxx).
// Leeg = demo-modus: het formulier bevestigt alleen lokaal.
const SIGNUP_ENDPOINT = "";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const { gsap, ScrollTrigger, Lenis } = window;
const PI = Math.PI;

// ---------- Fles-toestanden per scène ----------
// x, y: fractie van het scherm vanaf het midden · s: flesgrootte t.o.v. schermhoogte
// rx/rz: kantelen · ry: draaien om eigen as (−2,14 = zijkant, −2π = voorkant)
const SIDE = -2.14;
const STATES = {
  desktop: {
    hero:  { x: 0,     y: -0.36, s: 1.05, rx: 0,    rz: 0,       ry: 0 },
    slok:  { x: 0.23,  y: 0.0,   s: 0.78, rx: 0.14, rz: -0.34,   ry: SIDE },
    roll:  { x: -0.08, y: -0.04, s: 0.92, rx: 0.1,  rz: PI / 2,  ry: SIDE - 2 * PI },
    roll2: { x: 0.08,  y: -0.04, s: 0.92, rx: -0.1, rz: PI / 2,  ry: SIDE - 4 * PI },
    local: { x: 0.25,  y: 0.0,   s: 0.8,  rx: 0.12, rz: -0.16,   ry: -6 * PI },
    away:  { x: 0.1,   y: 0.95,  s: 0.5,  rx: -0.4, rz: 0.9,     ry: -6.6 * PI },
    land:  { x: 0,     y: 0.2,   s: 0.56, rx: 0,    rz: 0,       ry: -8 * PI },
  },
  mobile: {
    hero:  { x: 0.24,  y: -0.3,  s: 0.8,  rx: 0,    rz: 0.06,    ry: 0 },
    slok:  { x: 0.06,  y: 0.2,   s: 0.44, rx: 0.14, rz: -0.34,   ry: SIDE },
    roll:  { x: 0,     y: -0.1,  s: 0.56, rx: 0.1,  rz: PI / 2,  ry: SIDE - 2 * PI },
    roll2: { x: 0,     y: -0.1,  s: 0.56, rx: -0.1, rz: PI / 2,  ry: SIDE - 4 * PI },
    local: { x: 0,     y: 0.21,  s: 0.42, rx: 0.12, rz: -0.16,   ry: -6 * PI },
    away:  { x: 0.3,   y: 0.95,  s: 0.36, rx: -0.4, rz: 0.9,     ry: -6.6 * PI },
    land:  { x: 0,     y: 0.24,  s: 0.44, rx: 0,    rz: 0,       ry: -8 * PI },
  },
};
// [toestand, trigger, start, eind]
const STEPS = [
  ["slok",  "#wat",       "top bottom", "top top"],
  ["roll",  "#anders",    "top bottom", "top top"],
  ["roll2", "#anders",    "top top",    "bottom bottom"],
  ["local", "#lokaal",    "top bottom", "top top"],
  ["away",  "#voor-wie",  "top bottom", "top 25%"],
  ["land",  "#aanmelden", "top bottom", "top top"],
];

// Schaal een kop zo dat hij precies de beschikbare breedte vult (zoals BOLD FLAVOR)
function fitText() {
  document.querySelectorAll("[data-fit]").forEach((el) => {
    el.style.fontSize = "";
    const spans = el.querySelectorAll(".line > span");
    let left = Infinity, right = -Infinity;
    spans.forEach((sp) => {
      const r = sp.getBoundingClientRect();
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    });
    const size = parseFloat(getComputedStyle(el).fontSize);
    const avail = el.clientWidth;
    const lines = new Set([...spans].map((sp) => Math.round(sp.getBoundingClientRect().top))).size;
    const byWidth = (size * avail) / (right - left) * 0.985;
    const byHeight = (innerHeight * 0.4) / (lines * 0.88); // nooit hoger dan 40% van het scherm
    el.style.fontSize = `${Math.min(byWidth, byHeight)}px`;
  });
}

// Knip een kop op in losse letters voor het letter-effect
function splitChars(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute("aria-label", el.textContent.trim());
  el.innerHTML = words
    .map((w) => `<span class="word" aria-hidden="true">${[...w].map((c) => `<span class="char">${c}</span>`).join("")}</span>`)
    .join(" ");
  return el.querySelectorAll(".char");
}

async function init() {
  if (!gsap || !ScrollTrigger) {
    document.documentElement.classList.add("no-webgl");
    initSignup();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // ---------- Smooth scroll ----------
  let lenis = null;
  if (Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6 });
      else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  // ---------- Topbar ----------
  ScrollTrigger.create({
    start: 40, end: "max",
    onToggle: (self) => document.querySelector(".topbar").classList.toggle("is-scrolled", self.isActive),
  });

  // ---------- Achtergrond loopt mee met de secties (zoals de productkleur in het voorbeeld) ----------
  const BG = { dille: "#8FAE87", roze: "#EBB3A9", room: "#F5F0E1" };
  const bg = { c: BG.dille };
  const setBg = () => document.documentElement.style.setProperty("--bg", bg.c);
  let prevBg = "dille";
  document.querySelectorAll("[data-bg]").forEach((el) => {
    const next = el.dataset.bg;
    if (next === prevBg) return;
    gsap.fromTo(bg, { c: BG[prevBg] }, {
      c: BG[next], ease: "none", immediateRender: false, onUpdate: setBg,
      scrollTrigger: { trigger: el, start: "top 75%", end: "top 25%", scrub: true },
    });
    prevBg = next;
  });

  // ---------- Kop op volle breedte ----------
  await document.fonts.ready;
  fitText();
  let fitRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => { fitText(); ScrollTrigger.refresh(); });
  });

  // ---------- Tekst-animaties ----------
  if (!reduceMotion) {
    gsap.from(".hero .line > span", { yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.09, delay: 0.15 });
    gsap.from("[data-intro]", { y: 24, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.1, delay: 0.45 });

    gsap.utils.toArray("[data-rise]").forEach((el) => {
      gsap.from(el, {
        y: 42, autoAlpha: 0, duration: 1, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });

    gsap.utils.toArray("[data-drift] > span").forEach((el, i) => {
      gsap.fromTo(el, { xPercent: i % 2 ? -14 : 14 }, {
        xPercent: i % 2 ? 14 : -14, ease: "none",
        scrollTrigger: { trigger: "#anders", start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // Kaarten schuiven open en groeien, zoals de fotokaarten in het voorbeeld
    gsap.fromTo(".sport",
      { clipPath: "inset(22% 12% 22% 12% round 18px)", scale: 0.88, autoAlpha: 0 },
      {
        clipPath: "inset(0% 0% 0% 0% round 18px)", scale: 1, autoAlpha: 1,
        duration: 1.1, ease: "expo.out", stagger: 0.07,
        scrollTrigger: { trigger: ".sports", start: "top 85%", once: true },
      });

    // Letters komen los binnen, zoals WHY THE JAR MATTERS
    document.querySelectorAll("[data-scramble]").forEach((el) => {
      const chars = splitChars(el);
      gsap.from(chars, {
        yPercent: () => gsap.utils.random(-120, 120),
        rotate: () => gsap.utils.random(-30, 30),
        autoAlpha: 0, duration: 1.1, ease: "expo.out",
        stagger: { each: 0.025, from: "random" },
        scrollTrigger: { trigger: el, start: "top 80%", once: true },
      });
    });
  }

  initSignup();

  // ---------- 3D-fles ----------
  let stage;
  try {
    stage = await createStage(document.getElementById("stage"));
  } catch (err) {
    console.warn("WebGL niet beschikbaar, fallback naar zegel", err);
    document.documentElement.classList.add("no-webgl");
    return;
  }

  const target = {};
  const follow = { y: 0 }; // extra verschuiving als de pagina na de landing verder scrollt
  const current = {};
  const intro = { y: reduceMotion ? 0 : -0.7, ry: reduceMotion ? 0 : 1.6 * PI, k: 1 };

  const mm = gsap.matchMedia();
  mm.add({ desktop: "(min-width: 1080px)", mobile: "(max-width: 1079px)" }, (ctx) => {
    const S = STATES[ctx.conditions.desktop ? "desktop" : "mobile"];
    Object.assign(target, S.hero);
    if (!Object.keys(current).length) Object.assign(current, S.hero);

    let prev = "hero";
    for (const [name, trigger, start, end] of STEPS) {
      gsap.fromTo(target, { ...S[prev] }, {
        ...S[name], ease: "none", immediateRender: false,
        scrollTrigger: { trigger, start, end, scrub: true },
      });
      prev = name;
    }
    // Na het landen beweegt de fles mee omhoog met de pagina, zodat hij boven de kop blijft
    gsap.fromTo(follow, { y: 0 }, {
      y: () => (ScrollTrigger.maxScroll(window) - document.querySelector("#aanmelden").offsetTop) / innerHeight,
      ease: "none",
      scrollTrigger: { trigger: "#aanmelden", start: "top top", end: "max", scrub: true, invalidateOnRefresh: true },
    });
    ScrollTrigger.refresh();
  });

  if (!reduceMotion) {
    gsap.to(intro, { y: 0, ry: 0, k: 1, duration: 1.8, ease: "expo.out", delay: 0.1 });
  }

  // Muis-parallax (alleen op apparaten met een muis)
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (matchMedia("(hover: hover)").matches && !reduceMotion) {
    window.addEventListener("pointermove", (e) => {
      pointer.x = e.clientX / innerWidth - 0.5;
      pointer.y = e.clientY / innerHeight - 0.5;
    }, { passive: true });
  }

  const frame = {};
  let time = 0;
  gsap.ticker.add((_, deltaMs) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    time += dt;
    // Frame-onafhankelijke demping: de fles volgt de scroll zacht, zonder schokken
    const a = reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    for (const k in target) current[k] += (target[k] - current[k]) * a;
    const p = 1 - Math.exp(-dt * 4);
    pointer.sx += (pointer.x - pointer.sx) * p;
    pointer.sy += (pointer.y - pointer.sy) * p;

    const idle = reduceMotion ? 0 : 1;
    frame.x = current.x;
    frame.y = current.y + follow.y + intro.y + Math.sin(time * 1.1) * 0.007 * idle;
    frame.s = current.s * intro.k;
    frame.rx = current.rx + pointer.sy * 0.18;
    frame.rz = current.rz + Math.sin(time * 0.7) * 0.025 * idle;
    frame.ry = current.ry + intro.ry + pointer.sx * 0.5;
    stage.apply(frame);
    stage.render();
  });
}

// ---------- Aanmelden ----------
function initSignup() {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  document.querySelectorAll("form[data-signup]").forEach((form) => {
    const msg = form.querySelector(".signup__msg");
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.classList.remove("is-error");
      if (form.website.value) return; // honeypot: bot

      const email = input.value.trim();
      if (!EMAIL_RE.test(email)) {
        msg.textContent = "Dat e-mailadres klopt nog niet helemaal.";
        msg.classList.add("is-error");
        input.focus();
        return;
      }

      button.disabled = true;
      try {
        if (SIGNUP_ENDPOINT) {
          const res = await fetch(SIGNUP_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!res.ok) throw new Error(res.status);
        }
        form.classList.add("is-done");
        msg.textContent = "Top, je staat op de lijst. Tot bij de lancering!";
      } catch {
        msg.textContent = "Er ging iets mis. Probeer het zo nog eens.";
        msg.classList.add("is-error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

init();
