import type { ImageExt } from "@lib/imageType";

// Chave da foto de perfil no armazenamento: avatars/<id do usuário>/<32 hex aleatórios>.<ext>.
// A chave é sempre gerada no servidor; cada foto nova ganha uma chave nova.

export const AVATAR_MAX_BYTES = 512 * 1024;

const KEY_PATTERN = /^avatars\/(\d+)\/([a-f0-9]{32})\.(png|jpg|webp)$/;

const CONTENT_TYPES: Record<ImageExt, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export function buildAvatarKey(userId: number, ext: ImageExt, randomHex: string): string {
  return `avatars/${userId}/${randomHex}.${ext}`;
}

export function isAvatarKeyOf(key: string | null | undefined, userId: number): key is string {
  const match = key ? KEY_PATTERN.exec(key) : null;
  return Boolean(match) && Number(match![1]) === userId;
}

export function avatarContentType(key: string): string {
  const ext = KEY_PATTERN.exec(key)?.[3] as ImageExt | undefined;
  return ext ? CONTENT_TYPES[ext] : "application/octet-stream";
}

// O parâmetro v muda a cada foto, então a resposta pode ficar em cache no navegador para sempre.
export function avatarUrl(key: string | null | undefined): string | null {
  const match = key ? KEY_PATTERN.exec(key) : null;
  return match ? `/api/account/avatar?v=${match[2]}` : null;
}
