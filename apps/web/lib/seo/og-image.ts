import "server-only";
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";

/**
 * The default Open Graph image (§6.24, §13). Drawn with `@napi-rs/canvas`
 * because next/og (satori) neither shapes Arabic nor lays out right to left;
 * Skia shapes with HarfBuzz, so letters join and runs read right.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const FONT_FILE = "assets/fonts/IBMPlexSansArabic-Regular.ttf";
const FAMILY = "OG Plex Arabic";

/** §13 tokens: navy background, gold accents only, ivory text (AA on navy). */
const COLORS = { navy: "#0B1F3A", gold: "#C9A24D", ivory: "#F7F3EA", muted: "#A9B4C6" } as const;

let registered = false;
function ensureFont(): void {
  if (registered) return;
  if (!GlobalFonts.registerFromPath(path.join(process.cwd(), FONT_FILE), FAMILY)) {
    throw new Error("og image font not registered");
  }
  registered = true;
}

/** Greedy word wrap to `maxWidth`, measured in the context's current font. */
export function wrapLines(
  ctx: Pick<SKRSContext2D, "measureText">,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderOgImage({
  siteName,
  tagline,
  direction,
}: {
  siteName: string;
  tagline: string;
  direction: "rtl" | "ltr";
}): Buffer {
  ensureFont();
  const { width, height } = OG_SIZE;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const pad = 96;
  const rtl = direction === "rtl";
  // The text's start edge: right in Arabic, left in English.
  const x = rtl ? width - pad : pad;

  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, width, height);

  // Gold frame line and start-edge bar.
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, width - 64, height - 64);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(rtl ? width - pad - 120 : pad, 200, 120, 6);

  ctx.direction = direction;
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.ivory;
  ctx.font = `76px "${FAMILY}"`;
  ctx.fillText(siteName, x, 310);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `40px "${FAMILY}"`;
  const lines = wrapLines(ctx, tagline, width - pad * 2).slice(0, 3);
  lines.forEach((text, i) => ctx.fillText(text, x, 390 + i * 60));

  return canvas.toBuffer("image/png");
}
