// Generated from src/utils/watermarkAnim.ts (npx esbuild src/utils/watermarkAnim.ts --format=esm --platform=node --outfile=discord-bot/watermarkAnim.js). Do not edit by hand: change the .ts and generate again.
const WM_CYCLE = 4.2;
const WM_ALPHA = 0.88;
const ENTER = 0.12;
const LEAD_IN = 0.22;
const FOLLOW_AT = ENTER + 0.13;
const FOLLOW_IN = 0.28;
const LEAVE = WM_CYCLE - 0.66;
const LEAD_OUT = 0.2;
const FOLLOW_OUT_AT = LEAVE + 0.1;
const FOLLOW_OUT = 0.3;
const SHIMMER = 3.4;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const easeInCubic = (p) => p * p * p;
const WM_STOPS = 6;
const markCorner = (t) => Math.floor(t / WM_CYCLE) % WM_STOPS;
const cornerIsRight = (c) => c % 2 === 0;
const markLines = (user, size, studioLabel, scale) => {
  const handle = `@${user.replace(/^@+/, "")}`;
  const s = scale;
  if (studioLabel) {
    const z2 = size === "sm" ? { b: 12, l: 4.6, h: 7 } : size === "fullscreen" ? { b: 20, l: 7.2, h: 11 } : { b: 16, l: 6, h: 9.5 };
    const lb = z2.b * 0.95;
    const ll = lb + z2.b * 0.3 + z2.l;
    const lh = ll + z2.b * 0.08 + z2.h * 1.05;
    return [
      { text: "NeyroTok", family: "'Montserrat', 'Outfit', sans-serif", weight: 600, size: z2.b * s, spacing: 0.01 * z2.b * s, baseline: lb * s, fill: "studioBrand" },
      { text: studioLabel, family: "'Montserrat', sans-serif", weight: 500, size: z2.l * s, spacing: 0.5 * z2.l * s, baseline: ll * s, fill: "studioLabel" },
      { text: handle, family: "'Montserrat', sans-serif", weight: 400, size: z2.h * s, spacing: 0, baseline: lh * s, fill: "studioHandle" }
    ];
  }
  const z = size === "sm" ? { b: 11, h: 8.5, yb: 11, yh: 21 } : size === "fullscreen" ? { b: 18, h: 12, yb: 19, yh: 36 } : { b: 15, h: 10.5, yb: 16, yh: 29 };
  return [
    { text: "NeyroTok", family: "'Outfit', 'Plus Jakarta Sans', sans-serif", weight: 800, size: z.b * s, spacing: -0.02 * z.b * s, baseline: z.yb * s, fill: "brand" },
    { text: handle, family: "'JetBrains Mono', monospace", weight: 700, size: z.h * s, spacing: 0, baseline: z.yh * s, fill: "handle" }
  ];
};
const fontOf = (l) => `${l.weight} ${l.size}px ${l.family}`;
const setSpacing = (ctx, px) => {
  try {
    ctx.letterSpacing = `${px}px`;
  } catch {
  }
};
const measureMark = (ctx, lines, scale) => {
  const widths = lines.map((l) => {
    ctx.font = fontOf(l);
    setSpacing(ctx, l.spacing);
    const w = ctx.measureText(l.text).width;
    setSpacing(ctx, 0);
    return Math.ceil(w + Math.abs(l.spacing));
  });
  const last = lines[lines.length - 1];
  return {
    lines,
    widths,
    width: Math.max(...widths),
    height: Math.ceil(last.baseline + last.size * 0.32),
    unit: scale
  };
};
const mix = (a, b, p) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * p)).join(",")})`;
};
const cycleColor = (values, phase) => {
  const x = phase * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(x));
  return mix(values[i], values[i + 1], x - i);
};
const fillFor = (ctx, l, x0, y0, w, shimmer) => {
  const ph = shimmer === null ? 0 : shimmer % SHIMMER / SHIMMER;
  if (l.fill === "brand") {
    const g = ctx.createLinearGradient(x0, y0 - l.size, x0 + w, y0 + l.size);
    g.addColorStop(0, cycleColor(["#FFFFFF", "#9CA3AF", "#FFFFFF"], ph));
    g.addColorStop(0.5, cycleColor(["#D4D4D8", "#FFFFFF", "#D4D4D8"], ph));
    g.addColorStop(1, cycleColor(["#9CA3AF", "#FFFFFF", "#9CA3AF"], ph));
    return g;
  }
  if (l.fill === "handle") {
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, cycleColor(["#FFFFFF", "#94A3B8", "#FFFFFF"], ph));
    g.addColorStop(0.5, cycleColor(["#CBD5E1", "#FFFFFF", "#CBD5E1"], ph));
    g.addColorStop(1, cycleColor(["#94A3B8", "#CBD5E1", "#94A3B8"], ph));
    return g;
  }
  if (l.fill === "studioBrand") {
    const g = ctx.createLinearGradient(0, y0 - l.size, 0, y0);
    g.addColorStop(0, "#F4F5F7");
    g.addColorStop(0.55, "#D2D5DB");
    g.addColorStop(1, "#A9AEB8");
    return g;
  }
  return l.fill === "studioLabel" ? "#7D88A3" : "#C3C8D2";
};
const markState = (tc, lineCount) => {
  if (tc < ENTER || tc >= FOLLOW_OUT_AT + FOLLOW_OUT) return null;
  const out = [];
  for (let i = 0; i < lineCount; i++) {
    const lead = i === 0;
    if (tc >= LEAVE) {
      if (lead) {
        const p = clamp01((tc - LEAVE) / LEAD_OUT);
        const e = easeInCubic(p);
        out.push({ from: 0, to: 1, scale: 1 - 0.7 * e, dx: -0.6 * e, alpha: p >= 1 ? 0 : 1 - e * e, smear: p < 1 ? 0.8 * Math.sin(Math.PI * Math.min(1, p * 1.1)) : 0 });
      } else {
        const start = FOLLOW_OUT_AT + (i - 1) * 0.03;
        const p = clamp01((tc - start) / FOLLOW_OUT);
        const e = easeInCubic(p);
        out.push({ from: e, to: 1, scale: 1, dx: -0.12 * e, alpha: p >= 1 ? 0 : 1, smear: p > 0 && p < 1 ? -0.5 * Math.sin(Math.PI * p) : 0 });
      }
      continue;
    }
    if (lead) {
      const p = clamp01((tc - ENTER) / LEAD_IN);
      const e = easeOutBack(p);
      out.push({ from: 0, to: 1, scale: 0.25 + 0.75 * e, dx: 0.18 * (1 - easeOutCubic(p)), alpha: clamp01(p * 4), smear: p < 1 ? 1.25 * (1 - easeOutCubic(p)) : 0 });
    } else {
      const start = FOLLOW_AT + (i - 1) * 0.04;
      const p = clamp01((tc - start) / FOLLOW_IN);
      const e = easeOutCubic(p);
      out.push({ from: 0, to: p > 0 ? e : 0, scale: 1, dx: 0.6 * (1 - e), alpha: p > 0 ? clamp01(p * 3) : 0, smear: p > 0 && p < 1 ? 0.6 * (1 - e) : 0 });
    }
  }
  return out;
};
const drawMarkAt = (ctx, lay, x, y, right, tc, shimmer) => {
  const st = markState(tc, lay.lines.length);
  if (!st) return;
  const u = lay.unit;
  const dir = right ? -1 : 1;
  const canBlur = "filter" in ctx;
  lay.lines.forEach((l, i) => {
    const s = st[i];
    if (!s || s.alpha <= 5e-3 || s.to - s.from <= 1e-3) return;
    const w = lay.widths[i];
    const lx = right ? x + lay.width - w : x;
    const by = y + l.baseline;
    const from = dir > 0 ? s.from : 1 - s.to;
    const to = dir > 0 ? s.to : 1 - s.from;
    const ax = right ? lx + w : lx;
    const ay = by - l.size * 0.35;
    const moving = Math.abs(s.smear) > 0.01;
    const copies = moving ? 18 : 1;
    for (let j = copies - 1; j >= 0; j--) {
      const trail = moving ? j / (copies - 1) * s.smear * w * dir : 0;
      ctx.save();
      ctx.globalAlpha = WM_ALPHA * s.alpha * (j === 0 ? 1 : 0.2 * Math.pow(1 - j / copies, 1.1) * (moving ? 1 : 0));
      if (j > 0 && canBlur) ctx.filter = `blur(${(1.2 * u).toFixed(2)}px)`;
      ctx.translate(ax + s.dx * w * dir + trail, ay);
      ctx.scale(s.scale, s.scale);
      ctx.translate(-ax, -ay);
      ctx.beginPath();
      ctx.rect(lx + w * from - 2 * u, y - l.size, w * (to - from) + 4 * u, lay.height + l.size * 2);
      ctx.clip();
      ctx.font = fontOf(l);
      setSpacing(ctx, l.spacing);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (j === 0) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.82)";
        ctx.shadowBlur = 4 * u;
        ctx.shadowOffsetY = 1 * u;
      }
      ctx.fillStyle = fillFor(ctx, l, lx, by, w, shimmer);
      ctx.fillText(l.text, lx, by);
      ctx.restore();
    }
  });
};
const MARK_ROOM = { left: 0.75, right: 1.05, y: 0.35 };
export {
  MARK_ROOM,
  WM_ALPHA,
  WM_CYCLE,
  WM_STOPS,
  cornerIsRight,
  drawMarkAt,
  markCorner,
  markLines,
  markState,
  measureMark
};
