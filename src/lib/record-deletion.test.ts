import { describe, expect, test } from "bun:test";
import { can } from "./permissions";
import { deletionRange, recordDeletionSchema } from "./record-deletion";

const employee = "11111111-1111-4111-8111-111111111111";
describe("attendance deletion scope", () => {
  test("selected employee keeps its identity and deletes the whole month", () => {
    const input = recordDeletionSchema.parse({ employee, period: "monthly", value: "2026-10" });
    expect(input.employee).toBe(employee);
    expect(deletionRange(input)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  test("all employees can be selected for a whole month", () => {
    const input = recordDeletionSchema.parse({ employee: "all", period: "monthly", value: "2028-02" });
    expect(input.employee).toBe("all");
    expect(deletionRange(input)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  test("individual record deletion stays in the selected day", () => {
    expect(deletionRange({ employee, period: "daily", value: "2026-10-29" }))
      .toEqual({ from: "2026-10-29", to: "2026-10-29" });
  });
  test("invalid dates and employee selections cannot widen deletion scope", () => {
    for (const input of [
      { employee: "", period: "monthly", value: "2026-10" },
      { employee, period: "monthly", value: "2026-13" },
      { employee, period: "daily", value: "2026-02-30" },
      { employee, period: "monthly", value: "" },
    ]) expect(recordDeletionSchema.safeParse(input).success).toBe(false);
  });
  test("administrators alone have deletion permission", () => {
    expect(can(["admin"], "records.delete")).toBe(true);
    expect(can(["manager"], "records.delete")).toBe(false);
    expect(can(["employee"], "records.delete")).toBe(false);
    expect(can([], "records.delete")).toBe(false);
  });
});