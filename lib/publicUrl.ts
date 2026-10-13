// Origem pública usada nos links de e-mail (convite, redefinição de senha, alertas).
// Vem só da configuração (APP_URL): montar o link a partir dos cabeçalhos da requisição deixaria
// quem faz a requisição escolher para onde aponta o link que a vítima recebe.
// Nunca use APP_BASE_URL aqui (é o endereço interno do Docker).

export class PublicUrlNotConfiguredError extends Error {
  constructor() {
    super("URL pública não configurada: defina APP_URL com o endereço que abre no navegador.");
    this.name = "PublicUrlNotConfiguredError";
  }
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getConfiguredPublicOrigin(override?: string): string | null {
  for (const candidate of [override, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    const normalized = normalizeOrigin(candidate?.trim());
    if (normalized) return normalized;
  }
  return null;
}

export function buildPublicUrl(pathname: string, params: Record<string, string>, override?: string): string {
  const base = getConfiguredPublicOrigin(override);
  if (!base) throw new PublicUrlNotConfiguredError();

  const url = new URL(pathname, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
