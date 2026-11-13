// Generates the placeholder artwork used by the seed data (dark-luxury, black & gold).
// Replace these with real coffee photography via Admin -> Gallery / Products / Website Appearance (uploads).
// Run: node scripts/generate-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/images/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out + "products", { recursive: true });

const GOLD = "#D5AC70", CHAMP = "#C8A66A", CREAM = "#F2E8D8";
const defs = (id, a = "#1d1611", b = "#0D0B0B") => `<defs>
<radialGradient id="bg${id}" cx="70%" cy="35%" r="90%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
<linearGradient id="gold${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${CHAMP}"/><stop offset=".5" stop-color="${GOLD}"/><stop offset="1" stop-color="${CREAM}"/></linearGradient>
<filter id="blur${id}"><feGaussianBlur stdDeviation="40"/></filter></defs>`;

function cup(cx, cy, s, id, steam = true) {
  const w = 220 * s, h = 170 * s;
  return `<g transform="translate(${cx - w / 2} ${cy - h / 2})" fill="none" stroke="url(#gold${id})" stroke-width="${3 * s}" stroke-linecap="round">
<path d="M0 ${20 * s} H${w} V${h * 0.55} Q${w} ${h} ${w * 0.5} ${h} Q0 ${h} 0 ${h * 0.55} Z" fill="rgba(213,172,112,.08)"/>
<path d="M${w} ${40 * s} q${60 * s} 0 ${60 * s} ${40 * s} t${-60 * s} ${40 * s}"/>
<ellipse cx="${w / 2}" cy="${20 * s}" rx="${w / 2}" ry="${12 * s}" fill="rgba(213,172,112,.15)"/>
<ellipse cx="${w / 2}" cy="${h + 12 * s}" rx="${w * 0.7}" ry="${10 * s}" stroke-opacity=".5"/>
${steam ? [0.3, 0.5, 0.7].map((p, i) => `<path d="M${w * p} ${-10 * s} q${-18 * s} ${-30 * s} 0 ${-55 * s} t0 ${-55 * s}" stroke-opacity="${0.8 - i * 0.2}"/>`).join("") : ""}</g>`;
}

const svg = (w, h, id, body, a, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Nocturne Café artwork">${defs(id, a, b)}<rect width="${w}" height="${h}" fill="url(#bg${id})"/>${body}</svg>`;

const dots = (w, h, n, seed) => {
  let r = seed, s = "";
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) s += `<circle cx="${rnd() * w}" cy="${rnd() * h}" r="${0.8 + rnd() * 2.2}" fill="${GOLD}" opacity="${0.15 + rnd() * 0.5}"/>`;
  return s;
};

// Hero
writeFileSync(out + "hero.svg", svg(1600, 900, "h",
  `<circle cx="1180" cy="330" r="260" fill="${GOLD}" opacity=".18" filter="url(#blurh)"/>${dots(1600, 900, 70, 7)}${cup(1180, 470, 1.9, "h")}
  <path d="M0 820 Q400 760 800 810 T1600 800 V900 H0Z" fill="#000" opacity=".5"/>`));
// Story
writeFileSync(out + "story.svg", svg(800, 1000, "s",
  `<circle cx="400" cy="380" r="240" fill="${GOLD}" opacity=".16" filter="url(#blurs)"/>${dots(800, 1000, 50, 11)}${cup(400, 520, 1.5, "s")}
  <text x="400" y="860" text-anchor="middle" font-family="Georgia,serif" font-size="34" letter-spacing="10" fill="${GOLD}">NOCTURNE</text>`));

// Gallery variations
const gv = [
  (id) => `${dots(800, 800, 40, 3)}${cup(400, 430, 1.7, id)}`,
  (id) => `<circle cx="400" cy="400" r="230" fill="none" stroke="url(#gold${id})" stroke-width="3"/><circle cx="400" cy="400" r="170" fill="none" stroke="url(#gold${id})" stroke-width="1.5" opacity=".6"/>${cup(400, 420, 1, id)}`,
  (id) => `${dots(800, 800, 60, 5)}<path d="M120 560 Q260 300 400 520 T680 360" fill="none" stroke="url(#gold${id})" stroke-width="4"/><path d="M120 620 Q260 380 400 600 T680 440" fill="none" stroke="url(#gold${id})" stroke-width="2" opacity=".5"/>`,
  (id) => `<rect x="190" y="190" width="420" height="420" rx="30" fill="none" stroke="url(#gold${id})" stroke-width="3"/>${cup(400, 410, 1.2, id)}`,
  (id) => `${dots(800, 800, 80, 9)}<circle cx="400" cy="400" r="130" fill="${GOLD}" opacity=".25" filter="url(#blur${id})"/>${cup(400, 440, 1.4, id, false)}`,
  (id) => `<path d="M0 560 Q200 480 400 560 T800 540 V800 H0Z" fill="${GOLD}" opacity=".12"/>${cup(400, 380, 1.5, id)}`,
];
gv.forEach((f, i) => writeFileSync(out + `gallery-${i + 1}.svg`, svg(800, 800, `g${i}`, f(`g${i}`), i % 2 ? "#241a12" : "#1d1611", "#0D0B0B")));

// Category art
const cats = { coffee: "#1f1610", "non-coffee": "#14201a", tea: "#1c1712", pastries: "#241810", desserts: "#22141a", meals: "#1a1a12", "seasonal-specials": "#1d1426" };
Object.entries(cats).forEach(([slug, tint], i) =>
  writeFileSync(out + `products/${slug}.svg`, svg(600, 600, `p${i}`, `${dots(600, 600, 30, i + 2)}${cup(300, 320, 1.15, `p${i}`, !["pastries", "desserts", "meals"].includes(slug))}`, tint, "#0D0B0B")));

console.log("Generated placeholder artwork in public/images");
