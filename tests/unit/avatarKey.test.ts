import { describe, expect, it } from "vitest";
import { avatarContentType, avatarUrl, buildAvatarKey, isAvatarKeyOf } from "@lib/avatarKey";

const HEX = "0123456789abcdef0123456789abcdef";

describe("buildAvatarKey / isAvatarKeyOf", () => {
  it("gera a chave dentro da pasta do usuário", () => {
    expect(buildAvatarKey(7, "webp", HEX)).toBe(`avatars/7/${HEX}.webp`);
  });

  it("aceita só chaves do próprio usuário", () => {
    expect(isAvatarKeyOf(`avatars/7/${HEX}.webp`, 7)).toBe(true);
    expect(isAvatarKeyOf(`avatars/8/${HEX}.webp`, 7)).toBe(false);
  });

  it("recusa chave fora do formato (travessia de pasta, extensão estranha, vazio)", () => {
    expect(isAvatarKeyOf(`avatars/7/../8/${HEX}.webp`, 7)).toBe(false);
    expect(isAvatarKeyOf(`avatars/7/${HEX}.svg`, 7)).toBe(false);
    expect(isAvatarKeyOf(`avatars/7/${HEX.slice(1)}.png`, 7)).toBe(false);
    expect(isAvatarKeyOf(null, 7)).toBe(false);
    expect(isAvatarKeyOf("", 7)).toBe(false);
  });
});

describe("avatarContentType", () => {
  it("deriva o tipo da extensão da chave", () => {
    expect(avatarContentType(`avatars/7/${HEX}.png`)).toBe("image/png");
    expect(avatarContentType(`avatars/7/${HEX}.jpg`)).toBe("image/jpeg");
    expect(avatarContentType(`avatars/7/${HEX}.webp`)).toBe("image/webp");
  });
});

describe("avatarUrl", () => {
  it("muda a cada foto nova, para o navegador não usar a antiga do cache", () => {
    expect(avatarUrl(`avatars/7/${HEX}.webp`)).toBe(`/api/account/avatar?v=${HEX}`);
  });

  it("devolve null quando não há foto", () => {
    expect(avatarUrl(null)).toBeNull();
    expect(avatarUrl("lixo")).toBeNull();
  });
});
