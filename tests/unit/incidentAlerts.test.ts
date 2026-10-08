import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({
  dbQuery: vi.fn(),
  dbExecute: vi.fn(async () => ({ affectedRows: 1 })),
}));
vi.mock("@lib/email", () => ({ sendMail: vi.fn() }));

import { sendMail } from "@lib/email";
import { dbExecute, dbQuery } from "@lib/mysql";
import { processIncidentAlerts } from "@lib/incidentAlerts";

const now = new Date("2026-10-08T12:00:00Z");
const recipients = [{ email: "a@exemplo.com" }, { email: "b@exemplo.com" }];
const downRows = [
  { id: 1, antennaName: "AP 1", networkName: "Rede A", lastDownAt: new Date("2026-10-08T11:00:00Z") },
  { id: 2, antennaName: "AP 2", networkName: "Rede A", lastDownAt: new Date("2026-10-08T11:30:00Z") },
];

describe("processIncidentAlerts", () => {
  beforeEach(() => {
    process.env.INCIDENT_ALERTS_ENABLED = "true";
    process.env.INCIDENT_ALERT_MIN_MINUTES = "10";
    process.env.APP_URL = "https://stats.test";
  });

  it("envia um único e-mail com todas as quedas e marca como enviadas", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce(downRows as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(sendMail).mockResolvedValue(undefined);

    const result = await processIncidentAlerts(now);

    expect(result).toEqual({ downSent: 2, recoverySent: 0 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMail).mock.calls[0][0]).toMatchObject({
      to: "a@exemplo.com, b@exemplo.com",
      subject: "[Stats A.P] 2 AP(s) offline",
    });
    const threshold = vi.mocked(dbQuery).mock.calls[1][1] as unknown[];
    expect(threshold).toEqual([new Date("2026-10-08T11:50:00Z")]);
    const update = vi.mocked(dbExecute).mock.calls.find(([sql]) => String(sql).includes("SET `alertSentAt`"));
    expect(update?.[1]).toEqual([now, now, 1, 2]);
    const events = vi.mocked(dbExecute).mock.calls.find(([sql]) => String(sql).startsWith("INSERT INTO `IncidentEvent`"));
    expect(events?.[1]).toEqual(expect.arrayContaining([1, "ALERT_SENT", 2, "ALERT_SENT"]));
  });

  it("não alerta ocorrências com alertas suprimidos (carga inicial da implantação)", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await processIncidentAlerts(now);

    const downSql = String(vi.mocked(dbQuery).mock.calls[1][0]);
    expect(downSql).toContain("`alertsSuppressed` = 0");
  });

  it("não marca nada quando o SMTP falha (tenta de novo no próximo ciclo)", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce(downRows as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(sendMail).mockRejectedValue(new Error("SMTP indisponível"));

    const result = await processIncidentAlerts(now);

    expect(result).toEqual({ downSent: 0, recoverySent: 0 });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("não consulta nada com os alertas desligados", async () => {
    process.env.INCIDENT_ALERTS_ENABLED = "false";

    await expect(processIncidentAlerts(now)).resolves.toEqual({ downSent: 0, recoverySent: 0 });
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("envia o resumo de normalização das ocorrências que tiveram alerta de queda", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ ...downRows[0], recoveredAt: new Date("2026-10-08T11:40:00Z") }] as never);
    vi.mocked(sendMail).mockResolvedValue(undefined);

    const result = await processIncidentAlerts(now);

    expect(result).toEqual({ downSent: 0, recoverySent: 1 });
    expect(vi.mocked(sendMail).mock.calls[0][0].subject).toBe("[Stats A.P] 1 AP(s) normalizado(s)");
    expect(vi.mocked(dbExecute).mock.calls.some(([sql]) => String(sql).includes("SET `recoveryAlertSentAt`"))).toBe(true);
  });
});
