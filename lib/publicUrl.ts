// Origem pública usada nos links de e-mail. Nunca use APP_BASE_URL (é interna do Docker).

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function toPublicOrigin(origin: string) {
  const url = new URL(origin);
  if (url.hostname === "0.0.0.0" || url.hostname === "::" || url.hostname === "[::]") {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function getConfiguredPublicOrigin(override?: string): string | null {
  for (const candidate of [override, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    const normalized = normalizeOrigin(candidate?.trim());
    if (normalized) return toPublicOrigin(normalized);
  }
  return null;
}

export function getRequestOrigin(req: Request): string {
  const originHeader = normalizeOrigin(req.headers.get("origin"));
  if (originHeader) return toPublicOrigin(originHeader);

  const refererHeader = normalizeOrigin(req.headers.get("referer"));
  if (refererHeader) return toPublicOrigin(refererHeader);

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (forwardedProto && forwardedHost) {
      return toPublicOrigin(`${forwardedProto}://${forwardedHost}`);
    }
  }

  const requestUrl = new URL(req.url);
  const host = req.headers.get("host")?.trim();
  if (host) return toPublicOrigin(`${requestUrl.protocol}//${host}`);
  return toPublicOrigin(requestUrl.origin);
}

export function buildPublicUrl(
  req: Request,
  pathname: string,
  params: Record<string, string>,
  override?: string
): string {
  const base = getConfiguredPublicOrigin(override) ?? getRequestOrigin(req);
  const url = new URL(pathname, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
