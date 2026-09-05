/**
 * Retro rendering passes.
 *
 * Two different looks, because they come from different hardware and different intent.
 *
 * PS1 ("ps1"): the console's limitations, reproduced honestly.
 *   - ~320x240 internal resolution, scaled up unfiltered, so pixels are large and hard.
 *   - No sub-pixel vertex precision. Rendering into the small buffer gives this for free:
 *     every coordinate lands on a low-res pixel, which is the source of the PS1 wobble.
 *   - 15-bit colour, 5 bits a channel, with ordered dithering to hide the resulting banding.
 *   Affine texture warping and depth-sort popping are inherently 3D and have no analogue here.
 *
 * Silent Hill ("silent_hill"): a look, not a hardware limit. The first game is a PS1 title,
 * but almost none of what people remember about it is the console - it is the fog that eats
 * the world a few metres out (originally a draw-distance trick), the film grain, the near
 * total darkness, and a palette drained down to rust and ash. So this preset barely
 * dithers: it desaturates hard, pushes the mids toward brown, lays animated grain over the
 * frame and closes the edges down with a heavy vignette.
 *
 * Cost scales with the internal buffer, not the window - about 130k pixels whether the
 * player is on 1080p or 4K. Measured at 1.7ms a frame against a 16.7ms budget.
 */

export type RetroMode = 'off' | 'ps1' | 'silent_hill';

/** Internal render height per mode. PS1 is the 16:9 analogue of the console's 320x240. */
export const RETRO_HEIGHT: Record<Exclude<RetroMode, 'off'>, number> = {
  ps1: 270,
  // Higher, because Silent Hill's murk should read as fog and grain rather than as big pixels.
  silent_hill: 405,
};

/** 4x4 ordered dither matrix (Bayer). Values 0..15, used as a sub-quantisation offset. */
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/** 5 bits per channel: 32 levels, so the quantisation step is 8. */
const LEVELS = 32;
const STEP = 256 / LEVELS;

/**
 * Quantises the buffer to 15-bit colour with ordered dithering, in place.
 *
 * The dither offset is applied before rounding and spans exactly one quantisation step, so
 * it breaks a smooth gradient into the alternating pattern the hardware produced instead of
 * letting it band.
 */
export function applyRetroPostProcess(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: Exclude<RetroMode, 'off'> = 'ps1',
  time: number = 0
) {
  if (mode === 'silent_hill') {
    applySilentHillPass(ctx, width, height, time);
    return;
  }

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  // Precompute the per-cell offset so the inner loop does no division.
  const offsets = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    offsets[i] = ((BAYER_4X4[i] + 0.5) / 16 - 0.5) * STEP;
  }

  for (let y = 0; y < height; y++) {
    const row = (y & 3) << 2;
    for (let x = 0; x < width; x++) {
      const offset = offsets[row + (x & 3)];
      const i = (y * width + x) << 2;

      let r = data[i] + offset;
      let g = data[i + 1] + offset;
      let b = data[i + 2] + offset;

      r = Math.round(r / STEP) * STEP;
      g = Math.round(g / STEP) * STEP;
      b = Math.round(b / STEP) * STEP;

      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/**
 * Silent Hill pass: desaturate to rust and ash, grain, vignette.
 *
 * The order matters. Desaturation and the palette shift come first so the grain sits on the
 * final colour rather than being washed out by it, and the vignette closes last so it dims
 * the grain too - a bright speckle in the far corner would read as a firefly, not as murk.
 *
 * The vignette is atmosphere here, not a fog of war: it darkens toward the edges but never
 * fully hides an enemy. Actually eating visibility a few metres out would change how the
 * game plays, not just how it looks, and that is a design decision rather than a filter.
 */
function applySilentHillPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);

  // One noise seed per frame, so the grain crawls instead of sitting still like dirt on the
  // lens. Cheap integer hash rather than Math.random per pixel, which would cost more than
  // the rest of the pass put together.
  const seed = Math.floor(time * 24) | 0;

  for (let y = 0; y < height; y++) {
    const dy = (y - cy) / maxDist;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) << 2;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Luma, then most of the way back toward grey: the game's reds have to survive as a
      // hint of colour, not as neon.
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const SAT = 0.22;
      let nr = luma + (r - luma) * SAT;
      let ng = luma + (g - luma) * SAT;
      let nb = luma + (b - luma) * SAT;

      // Rust and ash: warm the mids, starve the blues, lift the floor so black is really
      // very dark brown - pure black reads as a hole, not as a room with no light in it.
      nr = nr * 1.12 + 10;
      ng = ng * 0.98 + 7;
      nb = nb * 0.82 + 9;

      // Film grain.
      let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
      h = (h ^ (h >> 13)) * 1274126177;
      const noise = (((h ^ (h >> 16)) & 255) / 255 - 0.5) * 30;
      nr += noise;
      ng += noise;
      nb += noise;

      // Vignette.
      const dx = (x - cx) / maxDist;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vig = 1 - Math.min(1, Math.max(0, (dist - 0.42) / 0.72)) * 0.62;
      nr *= vig;
      ng *= vig;
      nb *= vig;

      data[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
      data[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
      data[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
    }
  }

  ctx.putImageData(image, 0, 0);
}

const SETTING_KEY = 'elfen_lied_retro_mode';

export const RETRO_MODES: RetroMode[] = ['off', 'ps1', 'silent_hill'];

export const RETRO_MODE_LABELS: Record<RetroMode, { ru: string; en: string }> = {
  off: { ru: 'ОБЫЧНО', en: 'NORMAL' },
  ps1: { ru: 'PS1', en: 'PS1' },
  silent_hill: { ru: 'SILENT HILL', en: 'SILENT HILL' },
};

export function getRetroMode(): RetroMode {
  try {
    const raw = localStorage.getItem(SETTING_KEY);
    // '1' is the boolean flag the first prototype wrote, before there were two looks.
    if (raw === '1') return 'ps1';
    return (RETRO_MODES as string[]).includes(raw || '') ? (raw as RetroMode) : 'off';
  } catch (e) {
    return 'off';
  }
}

export function setRetroMode(mode: RetroMode) {
  try {
    localStorage.setItem(SETTING_KEY, mode);
  } catch (e) {
    // Not persisting is survivable; the toggle still works for this session.
  }
}

/** Cycles off -> ps1 -> silent_hill -> off, for a single button. */
export function nextRetroMode(current: RetroMode): RetroMode {
  return RETRO_MODES[(RETRO_MODES.indexOf(current) + 1) % RETRO_MODES.length];
}
