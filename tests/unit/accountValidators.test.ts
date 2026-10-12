import { describe, expect, it } from "vitest";
import { changeEmailSchema, changePasswordSchema, profileSchema } from "@lib/accountValidators";

describe("profileSchema", () => {
  it("apara os textos e aceita cargo e telefone", () => {
    const parsed = profileSchema.parse({
      name: "  Ana Souza ",
      jobTitle: " Analista de Redes ",
      phone: " (11) 98888-7777 ",
    });
    expect(parsed).toEqual({ name: "Ana Souza", jobTitle: "Analista de Redes", phone: "(11) 98888-7777" });
  });

  it("cargo e telefone vazios viram null", () => {
    expect(profileSchema.parse({ name: "Ana", jobTitle: "", phone: "   " })).toEqual({
      name: "Ana",
      jobTitle: null,
      phone: null,
    });
    expect(profileSchema.parse({ name: "Ana" })).toEqual({ name: "Ana", jobTitle: null, phone: null });
  });

  it("recusa nome curto demais", () => {
    expect(profileSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it.each(["abc", "1234", "11 98888-7777 ramal x", "+55 (11) 98888-7777 9999 9999"])(
    "recusa telefone inválido: %s",
    (phone) => {
      expect(profileSchema.safeParse({ name: "Ana", phone }).success).toBe(false);
    }
  );

  it("aceita telefone com DDI", () => {
    expect(profileSchema.parse({ name: "Ana", phone: "+55 11 98888-7777" }).phone).toBe("+55 11 98888-7777");
  });
});

describe("changeEmailSchema", () => {
  it("normaliza o e-mail novo para minúsculas", () => {
    const parsed = changeEmailSchema.parse({ newEmail: "  Ana.Souza@Exemplo.COM ", currentPassword: "qualquer" });
    expect(parsed.newEmail).toBe("ana.souza@exemplo.com");
  });

  it("exige e-mail válido e a senha atual", () => {
    expect(changeEmailSchema.safeParse({ newEmail: "nao-e-email", currentPassword: "x" }).success).toBe(false);
    expect(changeEmailSchema.safeParse({ newEmail: "ana@exemplo.com", currentPassword: "" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("aplica a política de senha forte à senha nova", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "atual", newPassword: "fraca" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "atual", newPassword: "Senha#Forte2026" }).success).toBe(
      true
    );
  });
});
