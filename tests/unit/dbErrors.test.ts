import { describe, expect, it } from "vitest";
import { mapDbError } from "@lib/dbErrors";

describe("mapDbError", () => {
  it("mapeia duplicidade sem expor a mensagem do banco", () => {
    const mapped = mapDbError({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry 'ana@x.com' for key 'User_email_key'",
    });
    expect(mapped).toEqual({ status: 409, body: { ok: false, error: "UNIQUE_CONSTRAINT", field: "email" } });
  });

  it("erro desconhecido vira DB_ERROR genérico", () => {
    const mapped = mapDbError(new Error("connect ECONNREFUSED 10.0.0.5:38420"));
    expect(mapped).toEqual({ status: 500, body: { ok: false, error: "DB_ERROR" } });
    expect(JSON.stringify(mapped)).not.toContain("10.0.0.5");
  });
});
