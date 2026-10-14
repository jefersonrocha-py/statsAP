import { describe, expect, it } from "vitest";
import { parseStorageConfig } from "@lib/storageConfig";

const creds = { MINIO_ACCESS_KEY: "chave", MINIO_SECRET_KEY: "segredo" };

describe("parseStorageConfig", () => {
  it("lê o endpoint interno do compose", () => {
    expect(parseStorageConfig({ MINIO_ENDPOINT: "http://minio-statsap:38430", ...creds })).toEqual({
      endPoint: "minio-statsap",
      port: 38430,
      useSSL: false,
      accessKey: "chave",
      secretKey: "segredo",
      bucket: "statsap-avatars",
    });
  });

  it("usa a porta padrão do protocolo e o bucket informado", () => {
    expect(
      parseStorageConfig({ MINIO_ENDPOINT: "https://s3.exemplo.com", MINIO_BUCKET: "fotos", ...creds })
    ).toMatchObject({ endPoint: "s3.exemplo.com", port: 443, useSSL: true, bucket: "fotos" });
    expect(parseStorageConfig({ MINIO_ENDPOINT: "http://minio-statsap", ...creds })).toMatchObject({ port: 80 });
  });

  it("usa as credenciais do servidor quando as do app não foram definidas", () => {
    expect(
      parseStorageConfig({ MINIO_ENDPOINT: "http://minio-statsap:38430", MINIO_ROOT_USER: "root", MINIO_ROOT_PASSWORD: "senha" })
    ).toMatchObject({ accessKey: "root", secretKey: "senha" });
  });

  it("devolve null quando o armazenamento não está configurado", () => {
    expect(parseStorageConfig({})).toBeNull();
    expect(parseStorageConfig({ MINIO_ENDPOINT: "http://minio-statsap:38430" })).toBeNull();
    expect(parseStorageConfig({ MINIO_ENDPOINT: "minio-statsap sem protocolo", ...creds })).toBeNull();
    expect(parseStorageConfig({ MINIO_ENDPOINT: "ftp://minio-statsap:38431", ...creds })).toBeNull();
  });
});
