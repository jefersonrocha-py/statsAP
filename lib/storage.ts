import "server-only";

import { Client } from "minio";
import { parseStorageConfig, type StorageConfig } from "@lib/storageConfig";

// Armazenamento de objetos (MinIO). Hoje guarda só as fotos de perfil.
// O bucket é privado: os arquivos saem sempre pela aplicação, nunca direto do MinIO.

export class StorageUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageUnavailableError";
  }
}

type StorageState = { client: Client; config: StorageConfig; bucketReady: Promise<void> | null };
type StorageGlobal = typeof globalThis & { __objectStorage?: StorageState };

const REQUEST_TIMEOUT_MS = 8_000;
const NOT_FOUND_CODES = new Set(["NoSuchKey", "NotFound", "NoSuchBucket"]);

function getState(): StorageState {
  const store = globalThis as StorageGlobal;
  if (!store.__objectStorage) {
    const config = parseStorageConfig(process.env);
    if (!config) {
      throw new StorageUnavailableError("Armazenamento de objetos não configurado (MINIO_ENDPOINT e credenciais).");
    }
    const client = new Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    store.__objectStorage = { client, config, bucketReady: null };
  }
  return store.__objectStorage;
}

// O MinIO fora do ar não pode prender a requisição do usuário: cada operação tem um limite de tempo.
function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StorageUnavailableError("Tempo esgotado ao falar com o armazenamento de objetos.")),
      REQUEST_TIMEOUT_MS
    );
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

function errorCode(error: unknown) {
  return (error as { code?: string } | null)?.code ?? "";
}

function unavailable(error: unknown) {
  if (error instanceof StorageUnavailableError) return error;
  return new StorageUnavailableError("Armazenamento de objetos indisponível.", { cause: error });
}

// Cria o bucket no primeiro uso. Se falhar, a próxima chamada tenta de novo.
function ensureBucket(state: StorageState) {
  if (!state.bucketReady) {
    const { client, config } = state;
    state.bucketReady = (async () => {
      if (await client.bucketExists(config.bucket)) return;
      try {
        await client.makeBucket(config.bucket);
      } catch (error) {
        // Outra requisição criou o bucket ao mesmo tempo.
        if (errorCode(error) !== "BucketAlreadyOwnedByYou") throw error;
      }
    })().catch((error) => {
      state.bucketReady = null;
      throw error;
    });
  }
  return state.bucketReady;
}

export async function putStoredObject(key: string, body: Buffer, contentType: string) {
  try {
    const state = getState();
    await withTimeout(
      (async () => {
        await ensureBucket(state);
        await state.client.putObject(state.config.bucket, key, body, body.length, { "Content-Type": contentType });
      })()
    );
  } catch (error) {
    throw unavailable(error);
  }
}

export async function getStoredObject(key: string): Promise<Buffer | null> {
  try {
    const state = getState();
    return await withTimeout(
      (async () => {
        const stream = await state.client.getObject(state.config.bucket, key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return Buffer.concat(chunks);
      })()
    );
  } catch (error) {
    if (NOT_FOUND_CODES.has(errorCode(error))) return null;
    throw unavailable(error);
  }
}

export async function removeStoredObject(key: string) {
  try {
    const state = getState();
    await withTimeout(state.client.removeObject(state.config.bucket, key));
  } catch (error) {
    if (NOT_FOUND_CODES.has(errorCode(error))) return;
    throw unavailable(error);
  }
}
