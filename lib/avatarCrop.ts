// A foto de perfil é sempre um quadrado: recorta o centro da imagem enviada.

export const AVATAR_SIZE = 256;

export function centerCropRect(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}
