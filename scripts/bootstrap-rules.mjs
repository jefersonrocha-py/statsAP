// Decide o que o bootstrap do usuário padrão faz no startup.
// Só age em banco sem nenhum SUPERADMIN: nunca regrava senha, promove conta ou recria quem já existe.

/**
 * @param {{ superadminCount: number, emailTaken: boolean, email?: string, password?: string, name?: string }} input
 * @returns {"create" | "skip" | "missing-credentials" | "email-taken"}
 */
export function decideSuperadminBootstrap({ superadminCount, emailTaken, email, password, name }) {
  if (superadminCount > 0) return "skip";
  if (!email || !password || !name) return "missing-credentials";
  if (emailTaken) return "email-taken";
  return "create";
}
