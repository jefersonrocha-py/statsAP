const BASE = process.env.APP_BASE_URL?.trim();
if (!BASE) {
  console.error("[gdms-cron] APP_BASE_URL não definida: informe o endereço interno do serviço web no .env.");
  process.exit(1);
}
const PATH = process.env.SYNC_PATH || "/api/integrations/gdms/sync?mode=status";
const INTERVAL = Number(process.env.SYNC_INTERVAL_MS || 5 * 60 * 1000);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

async function runOnce() {
  const url = `${BASE}${PATH}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: INTERNAL_API_KEY ? { "x-internal-api-key": INTERNAL_API_KEY } : {},
    });
    const json = await response.json().catch(() => ({}));
    const stamp = new Date().toISOString();

    console.log(
      `[${stamp}] sync -> ${response.status}`,
      json?.ok ?? null,
      json?.totalFetched ?? json?.totalAps ?? json?.total ?? ""
    );
  } catch (error) {
    console.error("sync failed:", error?.message || error);
  }
}

console.log(`[gdms-cron] started, base=${BASE}, path=${PATH}, interval=${INTERVAL}ms`);
await runOnce();
setInterval(runOnce, INTERVAL);
