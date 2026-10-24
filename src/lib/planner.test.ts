import { describe, expect, it } from "vitest";
import { NOTES_MARKER, parseNotes, plannerDue, plannerNotes, plannerPriority, shadowEmail, taskIdFor, taskPush } from "./planner";
import { parseBrief } from "./brief";
import ownership from "./brief/fixtures/ownership.txt?raw";

const item = parseBrief(ownership).items.find((i) => i.title === "Payroll Export Failure")!;

describe("Planner bridge", () => {
  it("keeps the notes footer the Planner relies on", () => {
    // The Planner badges tasks by a notes line starting "— Daily Brief". Changing this breaks it.
    expect(NOTES_MARKER).toBe("— Daily Brief ·");
    const notes = plannerNotes(item, "Brief 26 Oct");
    expect(notes.split("\n").at(-1)).toBe("— Daily Brief · Do · Brief 26 Oct");
  });

  it("reads back what it writes", () => {
    const meta = parseNotes(plannerNotes(item));
    expect(meta).toMatchObject({ quadrant: "do", refs: ["INC0011111"], action: "Confirm root cause and fix date." });
  });

  it("derives the same v5-style task id every time, per account", async () => {
    const a = await taskIdFor("user-1", item.id);
    expect(a).toBe(await taskIdFor("user-1", item.id));
    expect(a).not.toBe(await taskIdFor("user-2", item.id));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("maps priority and due date", () => {
    expect([plannerPriority("critical"), plannerPriority("high"), plannerPriority("medium"), plannerPriority("low")]).toEqual([1, 2, 3, 4]);
    const monday = new Date(2026, 9, 26);
    expect(plannerDue({ ...item, due: "Today" }, monday)).toBe("2026-10-26");
    expect(plannerDue({ ...item, due: "Tomorrow" }, monday)).toBe("2026-10-27");
    expect(plannerDue({ ...item, due: "This week" }, monday)).toBe("2026-10-30");
    expect(plannerDue({ ...item, due: "", quadrant: "schedule" }, monday)).toBeUndefined();
  });

  it("pushes only the fields it sets", () => {
    const p = taskPush("id-1", { state: "done" }, 7);
    expect(p).toMatchObject({ table: "task", client_uuid: "id-1", base_rev: 7, fields: ["state"], payload: { state: "done" } });
    expect(Object.keys(p.field_times)).toEqual(["state"]);
  });

  it("maps usernames to the Planner's shadow email", () => {
    expect(shadowEmail("  YC ")).toBe("yc@planner-account.com");
  });
});
