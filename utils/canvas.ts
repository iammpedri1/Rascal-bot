export type CanvasModule = typeof import("@napi-rs/canvas");

let cached: CanvasModule | null = null;
const MAX_IMAGE_CACHE_ENTRIES = 32;
const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000;
type CachedImage = Awaited<ReturnType<CanvasModule["loadImage"]>>;
type ImageCacheEntry = { image: Promise<CachedImage>; expiresAt: number };
const imageCache = new Map<string, ImageCacheEntry>();

/**
 * Carrega o módulo nativo de canvas só na primeira renderização. Sem isso, os
 * comandos de imagem obrigariam o boot a carregar a biblioteca nativa (pesada)
 * mesmo que nunca fossem usados.
 */
export function loadCanvas(): CanvasModule {
  if (!cached) cached = require("@napi-rs/canvas") as CanvasModule;
  return cached;
}

export async function loadImageCached(url: string) {
  const parsed = new URL(String(url));
  if (parsed.protocol !== "https:") throw new Error("Canvas aceita somente imagens HTTPS.");

  const key = parsed.toString();
  const now = Date.now();
  const existing = imageCache.get(key);
  if (existing && (existing.expiresAt === 0 || existing.expiresAt > now)) {
    imageCache.delete(key);
    imageCache.set(key, existing);
    return existing.image;
  }
  if (existing) imageCache.delete(key);

  const entry: ImageCacheEntry = {
    image: Promise.resolve().then(() => loadCanvas().loadImage(key)),
    expiresAt: 0,
  };
  imageCache.set(key, entry);
  void entry.image.then(
    () => {
      if (imageCache.get(key) === entry) entry.expiresAt = Date.now() + IMAGE_CACHE_TTL_MS;
    },
    () => {
      if (imageCache.get(key) === entry) imageCache.delete(key);
    },
  );
  while (imageCache.size > MAX_IMAGE_CACHE_ENTRIES) {
    imageCache.delete(imageCache.keys().next().value as string);
  }
  return entry.image;
}

export function clearImageCache(): void {
  imageCache.clear();
}
