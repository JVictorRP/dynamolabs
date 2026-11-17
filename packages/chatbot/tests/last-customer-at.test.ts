import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { lastCustomerAtExpr } from "../src/conversations";

describe("lastCustomerAtExpr", () => {
  // Regressão em produção: o driver postgres.js não serializa um Date solto dentro de sql`...`
  // (ERR_INVALID_ARG_TYPE). O PGlite dos outros testes aceita, então aqui conferimos os parâmetros enviados.
  it("sends the timestamp as an ISO string with an explicit timestamptz cast, never as a raw Date", () => {
    const q = new PgDialect().sqlToQuery(lastCustomerAtExpr(new Date("2026-11-17T01:27:04.000Z")));
    expect(q.params.some((p) => p instanceof Date)).toBe(false);
    expect(q.params).toEqual(["2026-11-17T01:27:04.000Z", "2026-11-17T01:27:04.000Z"]);
    expect(q.sql).toContain("::timestamptz");
  });
});
