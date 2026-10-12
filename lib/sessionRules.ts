// Trocar a senha encerra as sessões abertas antes da troca (outros dispositivos).
// Cada token carrega o momento da emissão (iat, em segundos); o banco guarda o momento da troca.

// O DATETIME do MySQL não tem fração de segundo e arredonda: 15:00:00.900 viraria 15:00:01 e o
// token renovado às 15:00:00 pareceria anterior à troca. Por isso o corte é truncado para o segundo.
export function sessionCutoff(nowMs: number = Date.now()): Date {
  return new Date(Math.floor(nowMs / 1000) * 1000);
}

export function isTokenRevokedByPasswordChange(
  issuedAtSeconds: number | undefined,
  passwordChangedAt: Date | string | null | undefined
): boolean {
  if (!passwordChangedAt) return false;

  const changedAt = passwordChangedAt instanceof Date ? passwordChangedAt : new Date(String(passwordChangedAt));
  if (Number.isNaN(changedAt.getTime())) return false;
  if (typeof issuedAtSeconds !== "number") return true;

  return issuedAtSeconds * 1000 < changedAt.getTime();
}
