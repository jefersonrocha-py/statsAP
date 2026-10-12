import { AVATAR_SIZE, centerCropRect } from "@lib/avatarCrop";

// Roda só no navegador: recorta o centro da imagem escolhida e a reduz para AVATAR_SIZE × AVATAR_SIZE
// antes do envio. O arquivo que sobe ao servidor fica com poucas dezenas de KB.

export const AVATAR_SOURCE_MAX_BYTES = 15 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

export async function prepareAvatarBlob(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, size } = centerCropRect(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    // Navegador que não gera WebP devolve PNG; o servidor aceita os dois.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob) throw new Error("Falha ao gerar a imagem");
    return blob;
  } finally {
    bitmap.close();
  }
}
