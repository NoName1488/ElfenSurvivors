/**
 * Sprite registry.
 *
 * Every unit is currently a circle drawn with canvas primitives. This lets a PNG stand in
 * for one without touching the game logic: drop a file into public/sprites with the right
 * name and it replaces the shape on the next reload.
 *
 * Two rules make it safe to add art gradually:
 *
 *   - A missing or broken sprite is not an error. spriteFor() returns null and the caller
 *     draws the existing vector art, so the game is fully playable with no sprites at all,
 *     with one of them, or with all of them.
 *   - Loading is fire-and-forget. Nothing blocks on a sprite; the first frames after a load
 *     starts simply draw the fallback, and the sprite appears when the browser has it.
 *
 * Convention (see public/sprites/README.md for the full spec): sprites are drawn facing the
 * viewer, like a character standing in a side-scroller, and flipped horizontally to face
 * left. This is what Vampire Survivors and Brotato do in the same top-down camera, and it
 * costs one image per unit instead of one per direction.
 */

/** Where a sprite's anchor sits inside its image. Feet, so units stand on the ground plane. */
const ANCHOR_Y = 0.82;

type SpriteState = 'loading' | 'ready' | 'missing';

interface SpriteEntry {
  state: SpriteState;
  image: HTMLImageElement | null;
}

const cache = new Map<string, SpriteEntry>();

/** Names that were requested and had no file, so the spec can report what art is still needed. */
const missing = new Set<string>();

function spritePath(name: string): string {
  return `/sprites/${name}.png`;
}

/**
 * Returns the image for a sprite name, or null while it is loading or if there is no file.
 * Safe to call every frame; the work happens once per name.
 */
export function spriteFor(name: string): HTMLImageElement | null {
  const hit = cache.get(name);
  if (hit) return hit.state === 'ready' ? hit.image : null;

  if (typeof document === 'undefined') return null;

  const entry: SpriteEntry = { state: 'loading', image: null };
  cache.set(name, entry);

  const img = new Image();
  img.onload = () => {
    entry.state = 'ready';
    entry.image = img;
  };
  img.onerror = () => {
    // No art for this unit yet. Remember it so the game can list what is outstanding, and
    // never ask for it again.
    entry.state = 'missing';
    missing.add(name);
  };
  img.src = spritePath(name);

  return null;
}

/**
 * Draws a sprite centred on a unit, scaled so its height matches the unit's footprint.
 *
 * `radius` is the unit's collision radius, and the sprite is drawn a little larger than it -
 * a circle of radius r reads as a body about 3r tall, and matching the sprite to the raw
 * diameter makes every character look stunted.
 *
 * Returns false when there is no sprite, so the caller can fall back to its vector art:
 *
 *     if (!drawSprite(ctx, 'lucy', x, y, radius, facing)) {
 *       ...existing ctx.arc() drawing...
 *     }
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  radius: number,
  facingLeft: boolean = false
): boolean {
  const img = spriteFor(name);
  if (!img || !img.width || !img.height) return false;

  const height = radius * 3.0;
  const width = height * (img.width / img.height);

  ctx.save();
  ctx.imageSmoothingEnabled = false; // keep the pixel edges the retro passes rely on
  ctx.translate(x, y);
  if (facingLeft) ctx.scale(-1, 1);
  ctx.drawImage(img, -width / 2, -height * ANCHOR_Y, width, height);
  ctx.restore();
  return true;
}

/** Sprite names still without a file, for a dev readout. */
export function missingSprites(): string[] {
  return [...missing].sort();
}

// Exposed so art can be checked from the browser console without a build:
//   window.__missingSprites()
if (typeof window !== 'undefined') {
  (window as unknown as { __missingSprites?: () => string[] }).__missingSprites = missingSprites;
}
