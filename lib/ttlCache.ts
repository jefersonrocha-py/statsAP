// Cache em memória com TTL e deduplicação da chamada em andamento.
// Usado para não repetir dezenas de consultas ao GWN a cada aba aberta.
//
// maxStaleMs > ttlMs liga o "devolve o anterior e atualiza": um valor vencido, mas com idade menor
// que maxStaleMs, é devolvido na hora enquanto a recarga roda em segundo plano. Quem pede não espera
// a consulta lenta; o valor novo aparece na chamada seguinte.
export function createCachedLoader<T>(
  loader: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
  maxStaleMs = 0
) {
  let cached: { value: T; at: number } | null = null;
  let inflight: Promise<{ value: T; at: number }> | null = null;

  function refresh() {
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
    return inflight;
  }

  return async function load(): Promise<{ value: T; cachedAt: number }> {
    if (cached) {
      const age = now() - cached.at;
      if (age < ttlMs) return { value: cached.value, cachedAt: cached.at };

      if (age < maxStaleMs) {
        refresh().catch((error) => {
          console.error("createCachedLoader: falha ao atualizar em segundo plano:", error);
        });
        return { value: cached.value, cachedAt: cached.at };
      }
    }

    const fresh = await refresh();
    return { value: fresh.value, cachedAt: fresh.at };
  };
}
