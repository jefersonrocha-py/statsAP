import { describe, expect, it } from "vitest";
import { accountErrorMessage } from "@lib/accountMessages";

describe("accountErrorMessage", () => {
  it("usa a mensagem de validação do campo quando a API a devolve", () => {
    const payload = { details: [{ message: "A senha deve ter no mínimo 12 caracteres." }] };
    expect(accountErrorMessage("VALIDATION_FAILED", payload)).toBe("A senha deve ter no mínimo 12 caracteres.");
  });

  it.each([
    ["INVALID_PASSWORD", "A senha atual está incorreta."],
    ["EMAIL_TAKEN", "Este e-mail já está em uso por outra conta."],
    ["SAME_EMAIL", "O novo e-mail é igual ao atual."],
    ["SAME_PASSWORD", "A nova senha precisa ser diferente da atual."],
    ["UNSUPPORTED_IMAGE", "Formato não aceito. Envie uma imagem PNG, JPEG ou WebP."],
    ["STORAGE_UNAVAILABLE", "O armazenamento de fotos está indisponível agora. Tente de novo mais tarde."],
  ])("traduz %s", (code, message) => {
    expect(accountErrorMessage(code)).toBe(message);
  });

  it("informa o tempo de espera no limite de tentativas", () => {
    expect(accountErrorMessage("RATE_LIMITED", { retryAfterSec: 125 })).toBe(
      "Muitas tentativas. Aguarde 3 min e tente de novo."
    );
  });

  it("tem uma mensagem genérica para códigos desconhecidos", () => {
    expect(accountErrorMessage(null)).toBe("Não foi possível salvar agora. Tente de novo.");
    expect(accountErrorMessage("QUALQUER_COISA")).toBe("Não foi possível salvar agora. Tente de novo.");
  });
});
