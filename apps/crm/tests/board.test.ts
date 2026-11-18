import { describe, expect, it } from "vitest";
import { moveLeadInBoard } from "../src/lib/board";

const leads = [
  { id: "a", stageId: "s1" },
  { id: "b", stageId: "s1" },
  { id: "c", stageId: "s2" },
];

describe("moveLeadInBoard", () => {
  it("returns a new list with only the dragged lead moved", () => {
    const next = moveLeadInBoard(leads, "b", "s2");
    expect(next).toEqual([{ id: "a", stageId: "s1" }, { id: "b", stageId: "s2" }, { id: "c", stageId: "s2" }]);
    expect(leads[1].stageId).toBe("s1"); // não altera a lista original
  });
  it("keeps the same list when the stage did not change or the lead is unknown", () => {
    expect(moveLeadInBoard(leads, "a", "s1")).toBe(leads);
    expect(moveLeadInBoard(leads, "zzz", "s2")).toBe(leads);
  });
});
