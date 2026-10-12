import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({
  dbQueryOne: vi.fn(),
  dbExecute: vi.fn(),
  withTransaction: vi.fn(),
}));

import {
  changeAccountEmail,
  changeAccountPassword,
  getAccountProfile,
  replaceAvatarKey,
  updateAccountProfile,
} from "@lib/account";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";

const CURRENT_PASSWORD = "Senha#Atual2026";
const HEX = "0123456789abcdef0123456789abcdef";

type Row = Record<string, unknown>;
let row: Row;

function executedSql() {
  return vi.mocked(dbExecute).mock.calls.map((call) => String(call[0]));
}

beforeEach(async () => {
  vi.mocked(dbQueryOne).mockReset();
  vi.mocked(dbExecute).mockReset();
  vi.mocked(dbExecute).mockResolvedValue({ affectedRows: 1 } as never);
  vi.mocked(withTransaction).mockReset();
  vi.mocked(withTransaction).mockImplementation(async (callback) => callback({} as never));

  row = {
    id: 5,
    name: "Ana Souza",
    email: "ana@exemplo.com",
    role: "ADMIN",
    passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 4),
    phone: null,
    jobTitle: "Analista de Redes",
    avatarKey: `avatars/5/${HEX}.webp`,
  };
});

describe("getAccountProfile", () => {
  it("devolve os dados da conta com o endereço da foto, sem o hash da senha", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const profile = await getAccountProfile(5);

    expect(profile).toEqual({
      id: "5",
      name: "Ana Souza",
      email: "ana@exemplo.com",
      role: "ADMIN",
      phone: null,
      jobTitle: "Analista de Redes",
      avatarUrl: `/api/account/avatar?v=${HEX}`,
    });
  });

  it("devolve null quando o usuário não existe", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(null as never);
    expect(await getAccountProfile(99)).toBeNull();
  });
});

describe("updateAccountProfile", () => {
  it("grava nome, cargo e telefone e devolve o perfil atualizado", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({ ...row, name: "Ana S.", jobTitle: null, phone: "+55 11 98888-7777" } as never);

    const profile = await updateAccountProfile(5, { name: "Ana S.", jobTitle: null, phone: "+55 11 98888-7777" });

    expect(vi.mocked(dbExecute).mock.calls[0][1]).toEqual(["Ana S.", null, "+55 11 98888-7777", 5]);
    expect(profile).toMatchObject({ name: "Ana S.", jobTitle: null, phone: "+55 11 98888-7777" });
  });
});

describe("changeAccountEmail", () => {
  it("recusa quando a senha atual está errada, sem alterar nada", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const result = await changeAccountEmail(5, { newEmail: "nova@exemplo.com", currentPassword: "errada" });

    expect(result).toEqual({ ok: false, error: "INVALID_PASSWORD" });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("recusa o mesmo e-mail", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const result = await changeAccountEmail(5, { newEmail: "ana@exemplo.com", currentPassword: CURRENT_PASSWORD });

    expect(result).toEqual({ ok: false, error: "SAME_EMAIL" });
  });

  it("recusa e-mail que já pertence a outro usuário", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never).mockResolvedValueOnce({ id: 9 } as never);

    const result = await changeAccountEmail(5, { newEmail: "outro@exemplo.com", currentPassword: CURRENT_PASSWORD });

    expect(result).toEqual({ ok: false, error: "EMAIL_TAKEN" });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("troca o e-mail e informa o endereço anterior", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never).mockResolvedValueOnce(null as never);

    const result = await changeAccountEmail(5, { newEmail: "nova@exemplo.com", currentPassword: CURRENT_PASSWORD });

    expect(result).toMatchObject({ ok: true, previousEmail: "ana@exemplo.com", profile: { email: "nova@exemplo.com" } });
    expect(vi.mocked(dbExecute).mock.calls[0][1]).toEqual(["nova@exemplo.com", 5]);
  });
});

describe("changeAccountPassword", () => {
  const NEW_PASSWORD = "Senha#Nova2026!";

  it("recusa quando a senha atual está errada", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const result = await changeAccountPassword(5, { currentPassword: "errada", newPassword: NEW_PASSWORD });

    expect(result).toEqual({ ok: false, error: "INVALID_PASSWORD" });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("recusa senha nova igual à atual", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const result = await changeAccountPassword(5, { currentPassword: CURRENT_PASSWORD, newPassword: CURRENT_PASSWORD });

    expect(result).toEqual({ ok: false, error: "SAME_PASSWORD" });
  });

  it("grava o novo hash e o momento da troca truncado para o segundo", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);
    const now = Date.parse("2026-10-12T15:00:00.900Z");

    const result = await changeAccountPassword(5, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }, now);

    expect(result).toMatchObject({ ok: true, profile: { email: "ana@exemplo.com" } });
    const [hash, changedAt, id] = vi.mocked(dbExecute).mock.calls[0][1] as [string, Date, number];
    expect(await bcrypt.compare(NEW_PASSWORD, hash)).toBe(true);
    expect(changedAt.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(id).toBe(5);
  });

  it("invalida os links de redefinição de senha pendentes", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    await changeAccountPassword(5, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD });

    expect(executedSql().some((sql) => sql.includes("PasswordResetToken"))).toBe(true);
  });
});

describe("replaceAvatarKey", () => {
  it("grava a chave nova e devolve a anterior, para a foto antiga ser apagada", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({ avatarKey: `avatars/5/${HEX}.webp` } as never);
    const next = `avatars/5/${"f".repeat(32)}.png`;

    const previous = await replaceAvatarKey(5, next);

    expect(previous).toBe(`avatars/5/${HEX}.webp`);
    expect(vi.mocked(dbExecute).mock.calls[0][1]).toEqual([next, 5]);
  });
});
