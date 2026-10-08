// Cache em memória com TTL e deduplicação da chamada em andamento.
// Usado para não repetir dezenas de consultas ao GWN a cada aba aberta.
export function createCachedLoader<T>(
  loader: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now
) {
  let cached: { value: T; at: number } | null = null;
  let inflight: Promise<{ value: T; at: number }> | null = null;

  return async function load(): Promise<{ value: T; cachedAt: number }> {
    if (cached && now() - cached.at < ttlMs) {
      return { value: cached.value, cachedAt: cached.at };
    }

    if (!inflight) {
      inflight = loader()
        .then((value) => {
          cached = { value, at: now() };
          return cached;
        })
        .finally(() => {
          inflight = null;
        });
    }

    const fresh = await inflight;
    return { value: fresh.value, cachedAt: fresh.at };
  };
}
