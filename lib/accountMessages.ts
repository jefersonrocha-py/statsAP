// Mensagens em português para os erros das rotas de Minha Conta.

const MESSAGES: Record<string, string> = {
  INVALID_PASSWORD: "A senha atual está incorreta.",
  EMAIL_TAKEN: "Este e-mail já está em uso por outra conta.",
  SAME_EMAIL: "O novo e-mail é igual ao atual.",
  SAME_PASSWORD: "A nova senha precisa ser diferente da atual.",
  UNSUPPORTED_IMAGE: "Formato não aceito. Envie uma imagem PNG, JPEG ou WebP.",
  FILE_TOO_LARGE: "A imagem ficou grande demais. Escolha outra foto.",
  EMPTY_FILE: "O arquivo enviado está vazio.",
  STORAGE_UNAVAILABLE: "O armazenamento de fotos está indisponível agora. Tente de novo mais tarde.",
};

const FALLBACK = "Não foi possível salvar agora. Tente de novo.";

type ErrorPayload = { details?: Array<{ message?: unknown }>; retryAfterSec?: unknown } | null | undefined;

export function accountErrorMessage(code: string | null | undefined, payload?: ErrorPayload): string {
  if (code === "VALIDATION_FAILED") {
    const detail = payload?.details?.[0]?.message;
    return typeof detail === "string" && detail ? detail : "Confira os campos e tente de novo.";
  }

  if (code === "RATE_LIMITED") {
    const seconds = Number(payload?.retryAfterSec);
    const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : null;
    return minutes
      ? `Muitas tentativas. Aguarde ${minutes} min e tente de novo.`
      : "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }

  return (code && MESSAGES[code]) || FALLBACK;
}
