import type { Canvas } from "@napi-rs/canvas";

export type CanvasModule = typeof import("@napi-rs/canvas");

let cached: CanvasModule | null = null;
const MAX_CANVAS_DIMENSION = 4096;
const MAX_IMAGE_CACHE_ENTRIES = 200;
const imageCache = new Map<string, Promise<Awaited<ReturnType<CanvasModule["loadImage"]>>>>();
const reusableCanvases = new Map<string, Canvas>();

/**
 * Carrega o módulo nativo de canvas só na primeira renderização. Sem isso, os
 * comandos de imagem obrigariam o boot a carregar a biblioteca nativa (pesada)
 * mesmo que nunca fossem usados.
 */
export function loadCanvas(): CanvasModule {
  if (!cached) cached = require("@napi-rs/canvas") as CanvasModule;
  return cached;
}

export function loadImageCached(url: string): Promise<Awaited<ReturnType<CanvasModule["loadImage"]>>> {
  const key = String(url).trim();
  if (!key) return Promise.reject(new Error("URL de imagem vazia."));

  const existing = imageCache.get(key);
  if (existing) {
    imageCache.delete(key);
    imageCache.set(key, existing);
    return existing;
  }

  const pending = loadCanvas().loadImage(key)
    .catch((error: unknown) => {
      imageCache.delete(key);
      throw error;
    });
  imageCache.set(key, pending);
  while (imageCache.size > MAX_IMAGE_CACHE_ENTRIES) {
    const oldest = imageCache.keys().next().value;
    if (oldest) imageCache.delete(oldest);
  }
  return pending;
}

export function createCanvas(width: number, height: number): Canvas {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 ||
      width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    throw new RangeError(`Canvas deve ter dimensões entre 1 e ${MAX_CANVAS_DIMENSION}px.`);
  }
  return loadCanvas().createCanvas(width, height);
}

/** Reutiliza canvases síncronos de dimensões fixas; o contexto não escapa desta função. */
export function getReusableCanvas(width: number, height: number): Canvas {
  const key = `${width}x${height}`;
  const canvas = reusableCanvases.get(key) ?? createCanvas(width, height);
  reusableCanvases.set(key, canvas);
  canvas.getContext("2d").clearRect(0, 0, width, height);
  return canvas;
}

export const CANVAS_LIMITS = Object.freeze({
  maxDimension: MAX_CANVAS_DIMENSION,
  maxImageCacheEntries: MAX_IMAGE_CACHE_ENTRIES,
});
