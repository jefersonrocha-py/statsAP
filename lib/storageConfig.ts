// Configuração do armazenamento de objetos (MinIO) a partir das variáveis de ambiente.
// Sem endpoint ou credenciais, o armazenamento fica desligado e o resto da aplicação segue normal.

export type StorageConfig = {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
};

export const DEFAULT_STORAGE_BUCKET = "statsap-avatars";

export function parseStorageConfig(env: Record<string, string | undefined>): StorageConfig | null {
  const endpoint = env.MINIO_ENDPOINT?.trim();
  // No compose o app pode usar as credenciais do próprio servidor MinIO.
  const accessKey = env.MINIO_ACCESS_KEY?.trim() || env.MINIO_ROOT_USER?.trim();
  const secretKey = env.MINIO_SECRET_KEY?.trim() || env.MINIO_ROOT_PASSWORD?.trim();
  if (!endpoint || !accessKey || !secretKey) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const useSSL = url.protocol === "https:";
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : useSSL ? 443 : 80,
    useSSL,
    accessKey,
    secretKey,
    bucket: env.MINIO_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET,
  };
}
