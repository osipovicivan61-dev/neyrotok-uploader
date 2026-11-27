// The NeyroTok watermark for Discord bot videos, put on in the archive run (4 CPUs here, the bot's server has 0.15).
// A copy of neyrotok/discord-bot/watermark.js with the system ffmpeg; keep the two the same.
// Usage: node mark.mjs <in.mp4> <out.mp4> <nick> <9:16|16:9>
// The NeyroTok watermark on bot videos: "NeyroTok" and "@nick", the same mark as on the site's downloads
// (server.ts renderWatermarked, VideoWatermark.tsx): it moves between the corners TR, BL, TL, BR, 4.2 s in each,
// with 0.45 s fades. Made here, on the bot's own server, so the NeyroTok server spends nothing on it.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const FONT_FILES = ['Outfit-ExtraBold.ttf', 'JetBrainsMono-Bold.ttf'].map((f) => path.join(FONT_DIR, f)).filter((f) => fs.existsSync(f));
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

/** Size, length and bitrate of a video, from ffmpeg's own report (ffmpeg-static has no ffprobe) */
const probe = (file) =>
  new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', '-i', file], { maxBuffer: 4 * 1024 * 1024 }, (_err, _out, err) => {
      const text = String(err || '');
      const size = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/.exec(text);
      const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
      const rate = /bitrate:\s*(\d+)\s*kb\/s/.exec(text);
      resolve({
        width: size ? Number(size[1]) : 0,
        height: size ? Number(size[2]) : 0,
        duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
        kbps: rate ? Number(rate[1]) : 0,
      });
    });
  });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Puts the mark on a video. input: the mp4 as a Buffer; user: the nick without "@"; onProgress(0..1).
 * Returns the new mp4 as a Buffer.
 */
export async function watermarkVideo(input, user, aspectHint = '9:16', onProgress = () => {}) {
  const id = crypto.randomUUID();
  const tmp = os.tmpdir();
  const inPath = path.join(tmp, `nt_in_${id}.mp4`);
  const outPath = path.join(tmp, `nt_out_${id}.mp4`);
  const rightPath = path.join(tmp, `nt_wr_${id}.png`);
  const leftPath = path.join(tmp, `nt_wl_${id}.png`);
  try {
    fs.writeFileSync(inPath, input);
    const p = await probe(inPath);
    const W = p.width || (aspectHint === '16:9' ? 1280 : 720);
    const H = p.height || (aspectHint === '16:9' ? 720 : 1280);
    const duration = p.duration > 0.5 ? p.duration : 8;
    const landscape = W > H;
    // the feed's geometry in CSS pixels, the same numbers as on the site
    const geo = landscape
      ? { refWidth: 366, boxW: 145, boxH: 36, brandSize: 15, brandY: 16, handleSize: 10.5, handleY: 29, top: 12, bottom: 12, sideLeft: 14, sideRightTop: 14, sideRightBottom: 14 }
      : { refWidth: 390, boxW: 175, boxH: 44, brandSize: 18, brandY: 19, handleSize: 12, handleY: 36, top: 14, bottom: 100, sideLeft: 16, sideRightTop: 16, sideRightBottom: 64 };
    const k = Math.max(0.5, W / geo.refWidth);
    const pad = Math.round(6 * k);
    const boxW = Math.round(geo.boxW * k) + pad * 2;
    const boxH = Math.round(geo.boxH * k) + pad * 2;
    const inset = 3 * k;
    const nick = esc(String(user || 'neyrotok').replace(/^@+/, '').slice(0, 40));
    const svg = (right) => {
      const x = right ? boxW - pad - inset : pad + inset;
      const anchor = right ? 'end' : 'start';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}" viewBox="0 0 ${boxW} ${boxH}">
  <defs>
    <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="${pad}" y1="${pad}" x2="${boxW - pad}" y2="${boxH - pad}">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#D4D4D8"/><stop offset="100%" stop-color="#9CA3AF"/>
    </linearGradient>
    <linearGradient id="hg" gradientUnits="userSpaceOnUse" x1="${pad}" y1="0" x2="${boxW - pad}" y2="0">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#CBD5E1"/><stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <filter id="ds" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="${(1 * k).toFixed(2)}" stdDeviation="${(2 * k).toFixed(2)}" flood-color="#000000" flood-opacity="0.82"/>
    </filter>
  </defs>
  <g opacity="0.88">
    <text x="${x.toFixed(2)}" y="${(pad + geo.brandY * k).toFixed(2)}" text-anchor="${anchor}" font-family="Outfit" font-weight="800" font-size="${(geo.brandSize * k).toFixed(2)}" letter-spacing="${(-0.02 * geo.brandSize * k).toFixed(2)}" fill="url(#bg)" filter="url(#ds)">NeyroTok</text>
    <text x="${x.toFixed(2)}" y="${(pad + geo.handleY * k).toFixed(2)}" text-anchor="${anchor}" font-family="JetBrains Mono" font-weight="700" font-size="${(geo.handleSize * k).toFixed(2)}" fill="url(#hg)" filter="url(#ds)">@${nick}</text>
  </g>
</svg>`;
    };
    const fontOpts = { font: { fontFiles: FONT_FILES, loadSystemFonts: FONT_FILES.length === 0, defaultFontFamily: 'Outfit' } };
    fs.writeFileSync(rightPath, new Resvg(svg(true), fontOpts).render().asPng());
    fs.writeFileSync(leftPath, new Resvg(svg(false), fontOpts).render().asPng());

    const px = (v) => Math.round(v * k);
    const corners = [
      { right: true, x: W - px(geo.sideRightTop) - (boxW - pad), y: px(geo.top) - pad },
      { right: false, x: px(geo.sideLeft) - pad, y: H - px(geo.bottom) - (boxH - pad) },
      { right: false, x: px(geo.sideLeft) - pad, y: px(geo.top) - pad },
      { right: true, x: W - px(geo.sideRightBottom) - (boxW - pad), y: H - px(geo.bottom) - (boxH - pad) },
    ];
    const CYCLE = 4.2;
    const FADE = 0.45;
    const GAP = 0.65;
    const segs = [];
    for (let s = 0; ; s++) {
      const start = s === 0 ? 0 : s * CYCLE + GAP;
      if (start >= duration) break;
      const fadeOut = (s + 1) * CYCLE;
      segs.push({ start, fadeOut, end: Math.min(duration, fadeOut + FADE), c: corners[s % 4] });
    }
    const parts = [];
    const rightSegs = segs.filter((g) => g.c.right);
    const leftSegs = segs.filter((g) => !g.c.right);
    if (rightSegs.length) parts.push(`[1:v]format=rgba,split=${rightSegs.length}${rightSegs.map((_, i) => `[r${i}]`).join('')}`);
    if (leftSegs.length) parts.push(`[2:v]format=rgba,split=${leftSegs.length}${leftSegs.map((_, i) => `[l${i}]`).join('')}`);
    let prev = '0:v';
    let ri = 0;
    let li = 0;
    segs.forEach((g, i) => {
      const src = g.c.right ? `r${ri++}` : `l${li++}`;
      parts.push(`[${src}]fade=t=in:st=${g.start.toFixed(2)}:d=${FADE}:alpha=1,fade=t=out:st=${g.fadeOut.toFixed(2)}:d=${FADE}:alpha=1[w${i}]`);
      parts.push(`[${prev}][w${i}]overlay=x=${Math.max(0, g.c.x)}:y=${Math.max(0, g.c.y)}:enable='between(t,${g.start.toFixed(2)},${g.end.toFixed(2)})'[o${i}]`);
      prev = `o${i}`;
    });
    parts.push(`[${prev}]format=yuv420p[vout]`);
    // about the source's own bitrate, so the file stays as light as the original (Discord takes up to 10 MB)
    const kbps = p.kbps > 300 ? Math.round(p.kbps * 1.15) : 0;
    const args = [
      '-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats',
      '-i', inPath,
      '-loop', '1', '-framerate', '30', '-i', rightPath,
      '-loop', '1', '-framerate', '30', '-i', leftPath,
      '-filter_complex', parts.join(';'),
      '-map', '[vout]', '-map', '0:a?',
      '-t', duration.toFixed(3),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
      ...(kbps ? ['-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`] : []),
      '-c:a', 'copy', '-movflags', '+faststart',
      outPath,
    ];
    await new Promise((resolve, reject) => {
      const ff = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let errText = '';
      const timer = setTimeout(() => ff.kill('SIGKILL'), 8 * 60 * 1000);
      ff.stdout.on('data', (d) => {
        const m = /out_time_(?:us|ms)=(\d+)/.exec(String(d));
        if (m) onProgress(Math.max(0, Math.min(1, Number(m[1]) / 1e6 / duration)));
      });
      ff.stderr.on('data', (d) => {
        errText = (errText + String(d)).slice(-800);
      });
      ff.on('error', reject);
      ff.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg ${code}: ${errText.trim().slice(-300)}`));
      });
    });
    const out = fs.readFileSync(outPath);
    if (out.length < 1000) throw new Error('empty result');
    return out;
  } finally {
    for (const f of [inPath, outPath, rightPath, leftPath]) fs.rm(f, { force: true }, () => undefined);
  }
}

const [, , inFile, outFile, nickArg, aspectArg] = process.argv;
if (inFile && outFile) {
  const started = Date.now();
  const out = await watermarkVideo(fs.readFileSync(inFile), nickArg || 'neyrotok', aspectArg === '16:9' ? '16:9' : '9:16');
  fs.writeFileSync(outFile, out);
  console.log(`watermark: ${Math.round(out.length / 1024)} KB in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
