// Tipo real de uma imagem pelos primeiros bytes do arquivo. O nome e o Content-Type enviados pelo
// navegador não são confiáveis; SVG fica de fora porque pode carregar script.

export type ImageExt = "png" | "jpg" | "webp";
export type ImageType = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: ImageExt };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function matches(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (matches(bytes, PNG_SIGNATURE)) return { mime: "image/png", ext: "png" };
  if (matches(bytes, JPEG_SIGNATURE)) return { mime: "image/jpeg", ext: "jpg" };
  if (matches(bytes, RIFF) && matches(bytes, WEBP, 8)) return { mime: "image/webp", ext: "webp" };
  return null;
}
