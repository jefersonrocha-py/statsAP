import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/gdmsToken", () => ({
  getAccessToken: vi.fn(async () => "token-antigo"),
  refreshToken: vi.fn(async () => ({ accessToken: "token-novo", expiresAt: Date.now() + 3_600_000 })),
}));

import { refreshToken } from "@lib/gdmsToken";
import { countActiveClients, listAPsByNetwork, listNetworks } from "@services/gdms";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("services/gdms", () => {
  beforeEach(() => {
    process.env.GDMS_BASE = "https://gdms.test";
    process.env.GDMS_CLIENT_ID = "app";
    process.env.GDMS_CLIENT_SECRET = "secret";
    process.env.GDMS_PAGE_SIZE = "500";
  });

  it("normaliza latitude/longitude em texto e nome vazio do ap/list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          retCode: 0,
          data: {
            totalPage: 1,
            result: [
              { mac: "00:0B:82:AA:AA:01", name: "AP 1", status: 1, latitude: "-22.441292", longitude: "-46.972298" },
              { mac: "00:0B:82:AA:AA:02", name: "", status: 0, latitude: "", longitude: "" },
            ],
          },
        })
      )
    );

    const aps = await listAPsByNetwork("332714", "Rede A");

    expect(aps).toEqual([
      {
        networkId: "332714",
        networkName: "Rede A",
        apId: "00:0B:82:AA:AA:01",
        apName: "AP 1",
        status: "UP",
        coords: { lat: -22.441292, lng: -46.972298 },
      },
      {
        networkId: "332714",
        networkName: "Rede A",
        apId: "00:0B:82:AA:AA:02",
        apName: "AP-00:0B:82:AA:AA:02",
        status: "DOWN",
        coords: null,
      },
    ]);
  });

  it("renova o token e repete uma vez quando o GDMS responde 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ retCode: 0, data: { totalPage: 1, result: [{ id: 1, networkName: "Rede A" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const networks = await listNetworks();

    expect(networks).toEqual([{ id: "1", networkName: "Rede A" }]);
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("access_token=token-novo");
  });

  it("conta clientes ativos pelo total do client/list", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ retCode: 0, data: { total: 30, totalPage: 30, result: [{}] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(countActiveClients("332714")).resolves.toBe(30);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/oapi/v1.0.0/client/list");
    expect(JSON.parse(String(init.body))).toMatchObject({
      pageNum: 1,
      pageSize: 1,
      networkId: 332714,
      filter: { ssidId: "all_ssid" },
    });
  });

  it("não entra em laço se o 401 persistir", async () => {
    const fetchMock = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNetworks()).rejects.toThrow("status 401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
