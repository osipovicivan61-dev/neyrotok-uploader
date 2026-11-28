// The NeyroTok watermark for Discord bot videos, put on in the archive run (4 CPUs here, the bot's server has 0.15).
// A copy of neyrotok/discord-bot/watermark.js (ffmpeg from ffmpeg-static); keep the two the same.
// Usage: node mark.mjs <in.mp4> <out.mp4> <nick> <9:16|16:9>
// The NeyroTok watermark on bot videos: "NeyroTok" and "@nick" with the same motion as on the site
// (src/utils/watermarkAnim.ts, generated here as watermarkAnim.js): the mark grows in with a smear, the nick slides
// out, then it whooshes away and comes back at the next place: top right, middle left, bottom right, top left,
// middle right, bottom left, 4.2 s each. The frames of one cycle are drawn by the site's own drawing code
// (the same as the browser download, src/utils/videoWatermark.ts) and laid over the video with ffmpeg.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { WM_CYCLE, WM_STOPS, MARK_ROOM, drawMarkAt, markLines, markState, measureMark } from './watermarkAnim.js';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const FONTS = [
  ['Outfit-ExtraBold.ttf', 'Outfit'],
  ['JetBrainsMono-Bold.ttf', 'JetBrains Mono'],
];
let fontsReady = 0;
for (const [file, family] of FONTS) {
  const p = path.join(FONT_DIR, file);
  if (fs.existsSync(p) && GlobalFonts.registerFromPath(p, family)) fontsReady++;
}
// GitHub's runners no longer have ffmpeg: the static build from npm (ffmpeg-static)
const FFMPEG = process.env.FFMPEG_PATH || (await import('ffmpeg-static').then((m) => m.default).catch(() => null)) || 'ffmpeg';

const MARK_FPS = 30;

/** Size, length and bitrate of a video, from ffmpeg's own report (ffmpeg-static has no ffprobe) */
const probe = (file) =>
  new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', '-i', file], { maxBuffer: 4 * 1024 * 1024 }, (_err, _out, err) => {
      const text = String(err || '');
      const size = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/.exec(text);
      const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
      const rate = /bitrate:\s*(\d+)\s*kb\/s/.exec(text);
      let width = size ? Number(size[1]) : 0;
      let height = size ? Number(size[2]) : 0;
      if (/rotate\s*:\s*-?(90|270)|rotation of -?(90|270)/i.test(text)) [width, height] = [height, width];
      resolve({
        width,
        height,
        duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
        kbps: rate ? Number(rate[1]) : 0,
      });
    });
  });

/** One cycle of the moving mark as PNG files (30 a second), drawn by the site's code; equal frames drawn once */
const writeMarkFrames = (lay, right, dir, prefix) => {
  const w = Math.ceil(lay.width * (1 + MARK_ROOM.left + MARK_ROOM.right));
  const h = Math.ceil(lay.height * (1 + MARK_ROOM.y * 2));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const ox = lay.width * MARK_ROOM.left;
  const oy = lay.height * MARK_ROOM.y;
  const cache = new Map();
  const count = Math.round(WM_CYCLE * MARK_FPS);
  for (let i = 0; i < count; i++) {
    const tc = i / MARK_FPS;
    const st = markState(tc, lay.lines.length);
    const key = st ? JSON.stringify(st, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) : v)) : 'none';
    let png = cache.get(key);
    if (!png) {
      ctx.clearRect(0, 0, w, h);
      drawMarkAt(ctx, lay, ox, oy, right, tc, null);
      png = canvas.toBuffer('image/png');
      cache.set(key, png);
    }
    fs.writeFileSync(path.join(dir, `${prefix}_${String(i).padStart(4, '0')}.png`), png);
  }
};

/**
 * Puts the mark on a video. input: the mp4 as a Buffer; user: the nick without "@"; onProgress(0..1).
 * Returns the new mp4 as a Buffer.
 */
export async function watermarkVideo(input, user, aspectHint = '9:16', onProgress = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt_wm_'));
  const inPath = path.join(dir, 'in.mp4');
  const outPath = path.join(dir, 'out.mp4');
  try {
    fs.writeFileSync(inPath, input);
    const p = await probe(inPath);
    const W = p.width || (aspectHint === '16:9' ? 1280 : 720);
    const H = p.height || (aspectHint === '16:9' ? 720 : 1280);
    const duration = p.duration > 0.5 ? p.duration : 8;
    const landscape = W > H;
    // the same numbers as videoWatermark.ts (browser download) and VideoWatermark.tsx (the feed)
    const geo = landscape
      ? { refWidth: 366, boxH: 36, top: 12, bottom: 12, sideLeft: 14, sideRightTop: 14, sideRightBottom: 14 }
      : { refWidth: 390, boxH: 44, top: 14, bottom: 100, sideLeft: 16, sideRightTop: 16, sideRightBottom: 64 };
    const k = Math.max(0.5, W / geo.refWidth);
    const nick = String(user || 'neyrotok').replace(/^@+/, '').replace(/[^a-zA-Z0-9_.\-]/g, '').slice(0, 40) || 'neyrotok';
    const lines = markLines(nick, landscape ? 'contained' : 'fullscreen', '', k);
    const lay = measureMark(createCanvas(8, 8).getContext('2d'), lines, k);
    writeMarkFrames(lay, true, dir, 'r');
    writeMarkFrames(lay, false, dir, 'l');

    // the places, as in the feed: 0 top right, 1 middle left, 2 bottom right, 3 top left, 4 middle right, 5 bottom left
    const px = (v) => Math.round(v * k);
    const inset = 3 * k;
    const xRight = (side) => Math.round(W - px(side) - inset - lay.width - lay.width * MARK_ROOM.left);
    const xLeft = Math.round(px(geo.sideLeft) + inset - lay.width * MARK_ROOM.left);
    const yTop = Math.round(px(geo.top) - lay.height * MARK_ROOM.y);
    const yBottom = Math.round(H - px(geo.bottom) - geo.boxH * k - lay.height * MARK_ROOM.y);
    const yMid = Math.round(H / 2 - lay.height / 2 - lay.height * MARK_ROOM.y);
    const C = `mod(floor(t/${WM_CYCLE}),${WM_STOPS})`;
    const filter = [
      '[1:v]format=rgba[mr]',
      '[2:v]format=rgba[ml]',
      `[0:v][mr]overlay=x='if(eq(${C},2),${xRight(geo.sideRightBottom)},${xRight(geo.sideRightTop)})':y='if(eq(${C},0),${yTop},if(eq(${C},2),${yBottom},${yMid}))':eval=frame:shortest=1:enable='eq(mod(${C},2),0)'[o1]`,
      `[o1][ml]overlay=x=${xLeft}:y='if(eq(${C},1),${yMid},if(eq(${C},3),${yTop},${yBottom}))':eval=frame:shortest=1:enable='eq(mod(${C},2),1)',format=yuv420p[vout]`,
    ].join(';');
    // about the source's own bitrate, so the file stays as light as the original (Discord takes up to 10 MB)
    const kbps = p.kbps > 300 ? Math.round(p.kbps * 1.15) : 0;
    const args = [
      '-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats',
      '-i', inPath,
      '-loop', '1', '-framerate', String(MARK_FPS), '-i', path.join(dir, 'r_%04d.png'),
      '-loop', '1', '-framerate', String(MARK_FPS), '-i', path.join(dir, 'l_%04d.png'),
      '-filter_complex', filter,
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
    fs.rm(dir, { recursive: true, force: true }, () => undefined);
  }
}

const [, , inFile, outFile, nickArg, aspectArg] = process.argv;
if (inFile && outFile) {
  const started = Date.now();
  const out = await watermarkVideo(fs.readFileSync(inFile), nickArg || 'neyrotok', aspectArg === '16:9' ? '16:9' : '9:16');
  fs.writeFileSync(outFile, out);
  console.log(`watermark: ${Math.round(out.length / 1024)} KB in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
