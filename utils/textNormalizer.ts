import { createRequire } from "node:module";
import { join } from "node:path";

type NativeTextNormalizer = {
  normalizeContent(content: string): string;
};

const nodeRequire = createRequire(__filename);
let nativeNormalizer: NativeTextNormalizer | null | undefined;

function loadNativeNormalizer(): NativeTextNormalizer | null {
  if (nativeNormalizer !== undefined) return nativeNormalizer;

  if (String(process.env.RASCAL_NATIVE_TEXT ?? "").toLowerCase() !== "true") {
    nativeNormalizer = null;
    return nativeNormalizer;
  }

  try {
    nativeNormalizer = nodeRequire(join(process.cwd(), "native", "rascal-native")) as NativeTextNormalizer;
    return nativeNormalizer;
  } catch (error) {
    nativeNormalizer = null;
    console.warn("[textNormalizer] addon Rust indisponível; usando TypeScript.", error);
    return nativeNormalizer;
  }
}

export function normalizeContent(content: string): string {
  const native = loadNativeNormalizer();
  if (native) return native.normalizeContent(content);

  return String(content || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
