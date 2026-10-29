import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { can } from "./permissions";
import { deletionRange, recordDeletionSchema } from "./record-deletion";

const employee = "11111111-1111-4111-8111-111111111111";
describe("attendance deletion scope", () => {
  test("selected employee keeps its identity and deletes the whole month", () => {
    const input = recordDeletionSchema.parse({ employee, period: "monthly", value: "2026-10" });
    assert.equal(input.employee, employee);
    assert.deepEqual(deletionRange(input), { from: "2026-10-01", to: "2026-10-31" });
  });
  test("all employees can be selected for a whole month", () => {
    const input = recordDeletionSchema.parse({ employee: "all", period: "monthly", value: "2028-02" });
    assert.equal(input.employee, "all");
    assert.deepEqual(deletionRange(input), { from: "2028-02-01", to: "2028-02-29" });
  });
  test("individual record deletion stays in the selected day", () => {
    assert.deepEqual(deletionRange({ employee, period: "daily", value: "2026-10-29" }),
      { from: "2026-10-29", to: "2026-10-29" });
  });
  test("invalid dates and employee selections cannot widen deletion scope", () => {
    for (const input of [
      { employee: "", period: "monthly", value: "2026-10" },
      { employee, period: "monthly", value: "2026-13" },
      { employee, period: "daily", value: "2026-02-30" },
      { employee, period: "monthly", value: "" },
    ]) assert.equal(recordDeletionSchema.safeParse(input).success, false);
  });
  test("administrators alone have deletion permission", () => {
    assert.equal(can(["admin"], "records.delete"), true);
    assert.equal(can(["manager"], "records.delete"), false);
    assert.equal(can(["employee"], "records.delete"), false);
    assert.equal(can([], "records.delete"), false);
  });
});