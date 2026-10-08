import { describe, expect, it } from "vitest";
import {
  getIncidentAlertConfig,
  planIncidentAction,
  planIncidentTransition,
  type OpenIncidentSnapshot,
} from "@lib/incidentRules";

const at = new Date("2026-10-08T12:00:00Z");
const openIncident: OpenIncidentSnapshot = {
  id: 12,
  status: "OPEN",
  lastDownAt: new Date("2026-10-08T11:30:00Z"),
  recoveredAt: null,
  downCount: 1,
};

describe("planIncidentTransition", () => {
  it("UP → DOWN sem ocorrência pendente abre uma nova", () => {
    expect(planIncidentTransition({ previousStatus: "UP", status: "DOWN", at, openIncident: null })).toEqual({
      kind: "open",
      events: [{ type: "OPENED", message: "O AP ficou offline.", toStatus: "OPEN" }],
    });
  });

  it("UP → DOWN com ocorrência em tratativa soma a queda na mesma ocorrência", () => {
    const plan = planIncidentTransition({
      previousStatus: "UP",
      status: "DOWN",
      at,
      openIncident: { ...openIncident, status: "IN_PROGRESS", recoveredAt: at, downCount: 2 },
    });
    expect(plan).toEqual({
      kind: "wentDownAgain",
      incidentId: 12,
      downCount: 3,
      events: [{ type: "WENT_DOWN_AGAIN", message: "O AP caiu novamente (3ª queda nesta ocorrência)." }],
    });
  });

  it("DOWN → UP com ocorrência aberta (sem tratativa) normaliza automaticamente", () => {
    const plan = planIncidentTransition({ previousStatus: "DOWN", status: "UP", at, openIncident });
    expect(plan).toMatchObject({ kind: "recovered", incidentId: 12, offlineSeconds: 1_800, autoResolve: true });
    if (plan.kind !== "recovered") throw new Error("esperava recovered");
    expect(plan.events.map((event) => event.type)).toEqual(["RECOVERED", "AUTO_RESOLVED"]);
    expect(plan.events[0].message).toBe("O AP voltou a ficar online após 30 min offline.");
  });

  it("DOWN → UP com ocorrência em tratativa só registra a volta", () => {
    const plan = planIncidentTransition({
      previousStatus: "DOWN",
      status: "UP",
      at,
      openIncident: { ...openIncident, status: "IN_PROGRESS" },
    });
    expect(plan).toMatchObject({ kind: "recovered", autoResolve: false });
    if (plan.kind !== "recovered") throw new Error("esperava recovered");
    expect(plan.events.map((event) => event.type)).toEqual(["RECOVERED"]);
  });

  it("DOWN → UP sem ocorrência, ou já recuperada, não faz nada", () => {
    expect(planIncidentTransition({ previousStatus: "DOWN", status: "UP", at, openIncident: null })).toEqual({ kind: "none" });
    expect(
      planIncidentTransition({ previousStatus: "DOWN", status: "UP", at, openIncident: { ...openIncident, recoveredAt: at } })
    ).toEqual({ kind: "none" });
  });

  it("status igual não é transição", () => {
    expect(planIncidentTransition({ previousStatus: "DOWN", status: "DOWN", at, openIncident })).toEqual({ kind: "none" });
  });
});

describe("planIncidentAction", () => {
  it("assumir tratativa só a partir de Aberta", () => {
    expect(planIncidentAction("OPEN", "START")).toMatchObject({
      ok: true,
      toStatus: "IN_PROGRESS",
      event: { type: "STATUS_CHANGED", message: "Tratativa iniciada.", fromStatus: "OPEN", toStatus: "IN_PROGRESS" },
    });
    expect(planIncidentAction("IN_PROGRESS", "START")).toEqual({ ok: false, error: "INVALID_TRANSITION" });
  });

  it("comentário exige pelo menos 3 caracteres e não muda o status", () => {
    expect(planIncidentAction("RESOLVED", "COMMENT", "  ok ")).toEqual({ ok: false, error: "MESSAGE_REQUIRED" });
    expect(planIncidentAction("RESOLVED", "COMMENT", "Trocado o PoE")).toMatchObject({
      ok: true,
      toStatus: "RESOLVED",
      event: { type: "COMMENT", message: "Trocado o PoE" },
    });
  });

  it("resolver exige descrever o que foi feito e não vale para ocorrência já resolvida", () => {
    expect(planIncidentAction("IN_PROGRESS", "RESOLVE", "ok")).toEqual({ ok: false, error: "MESSAGE_REQUIRED" });
    expect(planIncidentAction("IN_PROGRESS", "RESOLVE", "Cabo rompido substituído")).toMatchObject({
      ok: true,
      toStatus: "RESOLVED",
      event: { type: "RESOLVED", fromStatus: "IN_PROGRESS", toStatus: "RESOLVED" },
    });
    expect(planIncidentAction("RESOLVED", "RESOLVE", "Cabo rompido substituído")).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
  });

  it("recusa texto acima de 2000 caracteres", () => {
    expect(planIncidentAction("OPEN", "COMMENT", "a".repeat(2_001))).toEqual({ ok: false, error: "MESSAGE_TOO_LONG" });
  });
});

describe("getIncidentAlertConfig", () => {
  it("padrão: ligado, 10 minutos", () => {
    expect(getIncidentAlertConfig({})).toEqual({ enabled: true, minMinutes: 10 });
  });

  it("respeita desligamento e faixa de 1 a 1440 minutos", () => {
    expect(getIncidentAlertConfig({ INCIDENT_ALERTS_ENABLED: "false" }).enabled).toBe(false);
    expect(getIncidentAlertConfig({ INCIDENT_ALERT_MIN_MINUTES: "3" }).minMinutes).toBe(3);
    expect(getIncidentAlertConfig({ INCIDENT_ALERT_MIN_MINUTES: "0" }).minMinutes).toBe(10);
    expect(getIncidentAlertConfig({ INCIDENT_ALERT_MIN_MINUTES: "5000" }).minMinutes).toBe(10);
  });
});
