export type CanvasModule = typeof import("@napi-rs/canvas");

let cached: CanvasModule | null = null;

/**
 * Carrega o módulo nativo de canvas só na primeira renderização. Sem isso, os
 * comandos de imagem obrigariam o boot a carregar a biblioteca nativa (pesada)
 * mesmo que nunca fossem usados.
 */
export function loadCanvas(): CanvasModule {
  if (!cached) cached = require("@napi-rs/canvas") as CanvasModule;
  return cached;
}
