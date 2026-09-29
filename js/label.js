// Tekent het PEKL-etiket (118 × 58 mm uitgerold) op een canvas, voor de 3D-fles.
// Indeling van links naar rechts: achterzijde | lijmnaad | voorzijde (zegel) | zijkant.
// De voorzijde valt precies in het midden, zodat u = 0.5 naar de camera wijst.

export const LABEL_W = 2400;
export const LABEL_H = 1182; // 118 / 58 ≈ 2.03

const GREEN = "#264D33";
const INK = "#16271C";
const MUTED = "#8A958D";
const PICKLE_L = new Path2D(
  "M14 0 C22 0 28 6 28 14 L28 70 L50 70 C58 70 62 76 62 84 L61 88 C59 95 54 100 46 100 L10 100 C4 100 0 96 0 90 L0 14 C0 6 6 0 14 0 Z"
);

export async function loadLabelFonts() {
  await Promise.all([
    document.fonts.load('52px "Fugaz One"'),
    document.fonts.load('600 20px "Archivo"'),
    document.fonts.load('400 20px "Archivo"'),
  ]);
}

function spaced(ctx, text, x, y, spacing, align = "left") {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
}

// Tekst langs een cirkel. dir = 1: bovenboog (letters naar buiten), -1: onderboog (leesbaar van links naar rechts).
function arcText(ctx, text, cx, cy, r, centerAngle, spacing, dir) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let run = 0;
  ctx.textAlign = "center";
  chars.forEach((c, i) => {
    const mid = run + (widths[i] - spacing) / 2;
    const a = dir === 1 ? centerAngle - total / r / 2 + mid / r : centerAngle + total / r / 2 - mid / r;
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(dir === 1 ? a + Math.PI / 2 : a - Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    run += widths[i];
  });
}

function pickleL(ctx, x, y, h, fill = GREEN, dot = "#fff") {
  const s = h / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.transform(1, 0, Math.tan((-11 * Math.PI) / 180), 1, 0, 0);
  ctx.translate(19, 0);
  ctx.fillStyle = fill;
  ctx.fill(PICKLE_L);
  ctx.fillStyle = dot;
  for (const [dx, dy] of [[15, 22], [12, 37], [16, 52]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Woordmerk PEK + augurk-L, links uitgelijnd op x, basislijn op y.
function wordmark(ctx, x, y, size) {
  ctx.fillStyle = GREEN;
  ctx.font = `${size}px "Fugaz One"`;
  ctx.textAlign = "left";
  ctx.fillText("PEK", x, y);
  const w = ctx.measureText("PEK").width;
  const capH = size * 0.73;
  pickleL(ctx, x + w - size * 0.05, y - capH, capH);
}

function seal(ctx, cx, cy, d) {
  const k = d / 216; // zegel-viewBox: buitenring r = 108
  ctx.fillStyle = GREEN;
  ctx.strokeStyle = GREEN;

  ctx.lineWidth = 2.4 * k;
  ctx.beginPath();
  ctx.arc(cx, cy, 108 * k, 0, Math.PI * 2);
  ctx.stroke();

  const rd = 99 * k;
  const n = Math.round((2 * Math.PI * 99) / 6.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + rd * Math.cos(a), cy + rd * Math.sin(a), 1.25 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = `600 ${12.5 * k}px "Archivo"`;
  arcText(ctx, "PUUR AUGURKENSAP · 60 ML", cx, cy, 76 * k, -Math.PI / 2, 3.2 * k, 1);
  arcText(ctx, "AMSTERDAM · EST. 2026", cx, cy, 86 * k, Math.PI / 2, 3.2 * k, -1);

  ctx.font = `${52 * k}px "Fugaz One"`;
  ctx.textAlign = "center";
  ctx.fillText("PEK", cx - 16 * k, cy + 14 * k);
  pickleL(ctx, cx + 29 * k, cy - 23 * k, 38 * k);

  ctx.fillRect(cx - 20 * k, cy + 28 * k, 40 * k, 2.4 * k);
  ctx.font = `600 ${9 * k}px "Archivo"`;
  spaced(ctx, "PICKLE SHOT", cx, cy + 48 * k, 3 * k, "center");
}

function dashedV(ctx, x) {
  ctx.save();
  ctx.strokeStyle = "#B9C7BD";
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(x, 20);
  ctx.lineTo(x, LABEL_H - 20);
  ctx.stroke();
  ctx.restore();
}

function barcode(ctx, x, y, w, h) {
  ctx.fillStyle = INK;
  let cx = x;
  let seed = 7;
  while (cx < x + w) {
    seed = (seed * 9301 + 49297) % 233280;
    const bar = 2 + (seed % 4) * 2.2;
    ctx.fillRect(cx, y, bar, h);
    cx += bar + 3 + (seed % 3) * 2;
  }
}

export function drawLabel(canvas) {
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FBF8EE";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  ctx.textBaseline = "alphabetic";

  const seamX = 720, frontX = 768, sideX = 1632;

  // Lijmnaad
  ctx.fillStyle = GREEN;
  ctx.fillRect(seamX, 0, frontX - seamX, LABEL_H);

  // Voorzijde: zegel
  seal(ctx, (frontX + sideX) / 2, LABEL_H / 2, 760);

  // Zijkant
  dashedV(ctx, sideX);
  const sx = sideX + 84;
  ctx.fillStyle = GREEN;
  ctx.font = '600 30px "Archivo"';
  spaced(ctx, "INGREDIËNTEN", sx, 200, 8);
  ctx.fillStyle = INK;
  ctx.font = '400 38px "Archivo"';
  ["Water, augurkennat (32%),", "natuurazijn, zeezout,", "dille-extract, mosterdzaad."].forEach((l, i) => ctx.fillText(l, sx, 266 + i * 54));
  ctx.fillStyle = "#C9D6CD";
  ctx.fillRect(sx, 460, 560, 3);
  ctx.fillStyle = GREEN;
  ctx.font = '600 30px "Archivo"';
  spaced(ctx, "GEBRUIK", sx, 560, 8);
  ctx.fillStyle = INK;
  ctx.font = '400 38px "Archivo"';
  ["Goed schudden. Eén flesje", "ineens drinken, voor of na", "het sporten. Koel bewaren", "na opening."].forEach((l, i) => ctx.fillText(l, sx, 626 + i * 54));
  ctx.fillStyle = MUTED;
  ctx.font = '600 28px "Archivo"';
  spaced(ctx, "PEKL.NL", sx, 1080, 8);

  // Achterzijde: woordmerk, tabel, lot en streepjescode
  const bx = 64, bw = 600;
  wordmark(ctx, bx, 196, 96);
  ctx.fillStyle = GREEN;
  ctx.font = '600 28px "Archivo"';
  spaced(ctx, "60 ML", bx + bw, 186, 8, "right");

  const ty = 250, rowH = 84;
  ctx.fillStyle = GREEN;
  ctx.fillRect(bx, ty, bw, 100);
  ctx.fillStyle = "#fff";
  ctx.font = '600 26px "Archivo"';
  spaced(ctx, "VOEDINGSWAARDE PER 60 ML", bx + 32, ty + 62, 6);
  const rows = [["Energie", "9 kJ / 2 kcal"], ["Vetten", "0 g"], ["Koolhydraten", "0,4 g"], ["Eiwitten", "0 g"], ["Zout", "2,1 g"]];
  ctx.font = '400 34px "Archivo"';
  rows.forEach(([k, v], i) => {
    const y = ty + 100 + i * rowH;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(k, bx + 32, y + 54);
    ctx.textAlign = "right";
    ctx.font = '600 34px "Archivo"';
    ctx.fillText(v, bx + bw - 32, y + 54);
    ctx.font = '400 34px "Archivo"';
    if (i) {
      ctx.fillStyle = "#DCE3DD";
      ctx.fillRect(bx, y, bw, 2);
    }
  });
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 4;
  ctx.strokeRect(bx, ty, bw, 100 + rows.length * rowH);

  ctx.fillStyle = MUTED;
  ctx.font = '600 26px "Archivo"';
  spaced(ctx, "LOT 2609 · THT 03/2028", bx, 1010, 6);
  spaced(ctx, "GEBOTTELD IN NL", bx, 1060, 6);
  barcode(ctx, bx + bw - 190, 950, 190, 130);

  return canvas;
}
