import sharp from "sharp";
import { WATERMARK } from "./watermark";

/* ------------------------------------------------------------------ */
/* Product photography finishing. Each upload gets:                    */
/*   • a clean white sheet                                              */
/*   • the backdrop lifted out (flood fill from the frame, so a light  */
/*     product in the middle is never eaten)                           */
/*   • evened-out lighting with compressed specular highlights         */
/*   • a Cairoart.net mark set into the bottom of the image            */
/* The product itself is never redrawn, so what ships is the photo.    */
/* ------------------------------------------------------------------ */

const MAX_EDGE = 1400;
const SHEET = 1200;
const LOCAL_TOLERANCE = 18; // per-pixel step, so gradients on the backdrop still clear
const GLOBAL_TOLERANCE = 60; // how far from the sampled backdrop the fill may roam
const MARGIN_BOTTOM = 200;
const MARK_SCALE = 0.26;

type Backdrop = { r: number; g: number; b: number };

function sampleBackdrop(data: Buffer, width: number, height: number, channels: number): Backdrop {
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const stepX = Math.max(1, Math.floor(width / 140));
  const stepY = Math.max(1, Math.floor(height / 140));
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    reds.push(data[i]);
    greens.push(data[i + 1]);
    blues.push(data[i + 2]);
  };
  for (let x = 0; x < width; x += stepX) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    sample(0, y);
    sample(width - 1, y);
  }
  const median = (values: number[]) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return { r: median(reds), g: median(greens), b: median(blues) };
}

/* Flood fill from every border pixel whose colour matches the backdrop, so only
   the background connected to the edge of the frame is removed. */
function backdropMask(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  bg: Backdrop,
): Uint8Array {
  const keep = new Uint8Array(width * height).fill(1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const backdropDistance = (p: number) => {
    const i = p * channels;
    return Math.max(Math.abs(data[i] - bg.r), Math.abs(data[i + 1] - bg.g), Math.abs(data[i + 2] - bg.b));
  };
  const stepDistance = (p: number, from: number) => {
    const i = p * channels;
    const j = from * channels;
    return Math.max(
      Math.abs(data[i] - data[j]),
      Math.abs(data[i + 1] - data[j + 1]),
      Math.abs(data[i + 2] - data[j + 2]),
    );
  };
  const grow = (p: number, from: number) => {
    if (!keep[p]) return;
    if (backdropDistance(p) > GLOBAL_TOLERANCE) return;
    if (from >= 0 && stepDistance(p, from) > LOCAL_TOLERANCE) return;
    keep[p] = 0;
    queue[tail++] = p;
  };

  for (let x = 0; x < width; x += 1) {
    grow(x, -1);
    grow((height - 1) * width + x, -1);
  }
  for (let y = 0; y < height; y += 1) {
    grow(y * width, -1);
    grow(y * width + width - 1, -1);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    if (x > 0) grow(p - 1, p);
    if (x < width - 1) grow(p + 1, p);
    if (p >= width) grow(p - width, p);
    if (p + width < width * height) grow(p + width, p);
  }

  return keep;
}

/* Closing the foreground mask fills the thin background fingers a soft edge can
   let through, without eating thin product features. */
function closeMask(keep: Uint8Array, width: number, height: number, radius = 2): Uint8Array {
  const dilate = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let v = 0;
        for (let d = -radius; d <= radius && !v; d += 1) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          v = src[ny * width + nx];
        }
        out[y * width + x] = v;
      }
    }
    return out;
  };
  const erode = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let v = 1;
        for (let d = -radius; d <= radius && v; d += 1) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          v = src[ny * width + nx];
        }
        out[y * width + x] = v;
      }
    }
    return out;
  };
  return erode(erode(dilate(dilate(keep, true), false), true), false);
}

/* A one-pixel feather stops the cut edge reading as a hard sticker. */
function featherAlpha(keep: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (!keep[p]) continue;
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          sum += keep[ny * width + nx];
          count += 1;
        }
      }
      out[p] = Math.round((sum / count) * 255);
    }
  }
  return out;
}

function contentBox(alpha: Uint8Array, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] < 24) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function watermark(width: number) {
  const target = Math.round(width * MARK_SCALE);
  const scale = target / WATERMARK.width;
  const height = Math.round(WATERMARK.height * scale);
  const svg = `<svg width="${target}" height="${height}" viewBox="${WATERMARK.x} ${WATERMARK.y} ${WATERMARK.width} ${WATERMARK.height}" xmlns="http://www.w3.org/2000/svg"><path d="${WATERMARK.d}" fill="#4a4037" fill-opacity="0.68"/></svg>`;
  return { input: Buffer.from(svg), width: target, height };
}

export interface FinishedPhoto {
  buffer: Buffer;
  cutout: boolean;
  removed: number;
}

export async function processProductPhoto(input: Buffer): Promise<FinishedPhoto> {
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  if (!meta.width || !meta.height) throw new Error("that file is not a readable image");

  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  const width = Math.max(1, Math.round(meta.width * scale));
  const height = Math.max(1, Math.round(meta.height * scale));

  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(width, height, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const background = sampleBackdrop(data, info.width, info.height, channels);
  const rawKeep = backdropMask(data, info.width, info.height, channels, background);
  const keep = closeMask(rawKeep, info.width, info.height);
  const cleared = keep.reduce((missing, value) => missing + (value ? 0 : 1), 0) / keep.length;

  /* Trust an existing transparency; only cut when a real backdrop was found.
     A nearly full or nearly empty fill means the photo has no usable backdrop.
     An already-white backdrop needs no cut at all — keying it can only hurt. */
  const hasAlpha = Boolean(meta.hasAlpha);
  const whiteBackdrop = background.r >= 232 && background.g >= 232 && background.b >= 232;
  const cutout = hasAlpha || (!whiteBackdrop && cleared > 0.04 && cleared < 0.96);

  const working = Buffer.alloc(info.width * info.height * 4);
  const alpha = cutout && !hasAlpha ? featherAlpha(keep, info.width, info.height) : null;
  for (let p = 0; p < info.width * info.height; p += 1) {
    const i = p * channels;
    const o = p * 4;
    working[o] = data[i];
    working[o + 1] = data[i + 1];
    working[o + 2] = data[i + 2];
    working[o + 3] = alpha ? alpha[p] : hasAlpha ? data[i + 3] : originalAlpha(data, info, p, channels);
  }

  let art = sharp(working, { raw: { width: info.width, height: info.height, channels: 4 } });
  if (cutout) {
    const box = contentBox(
      alpha ?? working.filter((_, index) => index % 4 === 3),
      info.width,
      info.height,
    );
    if (box) art = sharp(working, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box);
  }

  const fitted = await art
    .resize(SHEET - 160, SHEET - MARGIN_BOTTOM - 40, { fit: "inside" })
    .normalize({ lower: 1, upper: 99 })
    .modulate({ brightness: 1.03, saturation: 1.02 })
    .linear(0.97, 4)
    .png()
    .toBuffer();
  const fittedMeta = await sharp(fitted).metadata();

  const mark = watermark(SHEET);
  const composed = await sharp({
    create: { width: SHEET, height: SHEET, channels: 3, background: "#ffffff" },
  })
    .composite([
      {
        input: fitted,
        left: Math.round((SHEET - (fittedMeta.width ?? SHEET)) / 2),
        top: 40,
      },
      { input: mark.input, left: Math.round((SHEET - mark.width) / 2), top: SHEET - 56 - mark.height },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: composed, cutout, removed: cleared };
}

/* Keeps the original alpha channel when the photo arrived with one. */
function originalAlpha(data: Buffer, info: { channels: number }, p: number, channels: number) {
  return channels === 4 ? data[p * 4 + 3] : 255;
}
