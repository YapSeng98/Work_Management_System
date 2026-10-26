import { describe, expect, it } from "vitest";
import { archivedItems, carriedOver, daysLeft, type BriefSnapshot } from "./carryOver";
import { parseBrief } from "./brief";
import ownership from "./brief/fixtures/ownership.txt?raw";
import ownershipV3 from "./brief/fixtures/ownership-v3.txt?raw";
import priority from "./brief/fixtures/priority.txt?raw";

const snap = (text: string, briefDate: string): BriefSnapshot => ({ briefDate, title: briefDate, items: parseBrief(text).items });
const titles = (c: ReturnType<typeof carriedOver>) => c.map((x) => x.item.title).sort();

describe("carried over from earlier briefs", () => {
  it("nothing to carry with a single brief", () => {
    expect(carriedOver([snap(ownership, "2026-10-23")])).toEqual([]);
  });

  it("carries my items that today's brief no longer mentions", () => {
    // 23 Oct: ownership brief. 26 Oct: priority brief that mentions INC0011111 and SR2222222 again.
    const c = carriedOver([snap(priority, "2026-10-26"), snap(ownership, "2026-10-23")]);
    expect(titles(c)).toEqual(["ERP Report Extra Columns"]); // the only "mine" item not mentioned again
    expect(c[0].fromDate).toBe("2026-10-23");
  });

  it("never carries the team's items, or ones a newer brief completed", () => {
    // 24 Oct (v3) marks the invoice bug completed; 25 Oct mentions nothing about it.
    const c = carriedOver([snap(priority, "2026-10-26"), snap(ownershipV3, "2026-10-24"), snap(ownership, "2026-10-23")]);
    expect(titles(c)).not.toContain("Invoice Resubmission Bug");
    expect(c.every((x) => x.item.owner === "me")).toBe(true);
  });

  it("only the most recent mention counts, and old briefs expire", () => {
    const c = carriedOver([snap(priority, "2026-10-26"), snap(ownershipV3, "2026-10-24"), snap(ownership, "2026-10-23")]);
    const ids = c.map((x) => x.item.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates across briefs
    expect(c.find((x) => x.item.title === "ERP Report Extra Columns")?.fromDate).toBe("2026-10-24");
    expect(carriedOver([snap(priority, "2026-11-30"), snap(ownership, "2026-10-23")])).toEqual([]);
  });
});

describe("archive", () => {
  const today = new Date(2026, 9, 26);
  const briefs = [snap(priority, "2026-10-26"), snap(ownershipV3, "2026-10-24"), snap(ownership, "2026-10-23")];

  it("lists every earlier item today's brief no longer mentions — mine, team's or customer's", () => {
    const a = archivedItems(briefs, 30, today);
    const owners = new Set(a.map((x) => x.item.owner));
    expect(owners.has("me") && owners.has("team")).toBe(true);
    expect(a.map((x) => x.item.title)).toContain("Mobile App Upload Enhancement"); // a team item
    expect(a.map((x) => x.item.title)).not.toContain("Invoice Resubmission Bug"); // completed on 24 Oct
    expect(a.some((x) => x.item.refs.includes("INC0011111"))).toBe(false); // still in today's brief
    expect(a.every((x) => !x.item.completed && x.item.owner !== "fyi")).toBe(true);
  });

  it("is newest brief first and keeps only the latest mention of each item", () => {
    const a = archivedItems(briefs, 30, today);
    const dates = a.map((x) => x.fromDate);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(a.map((x) => x.item.title)).size).toBe(a.length);
  });

  it("drops briefs past the 30-day keep period", () => {
    expect(archivedItems(briefs, 30, new Date(2026, 10, 30))).toEqual([]); // 30 Nov
    expect(archivedItems(briefs, 30, new Date(2026, 10, 22)).length).toBeGreaterThan(0); // 22 Nov: 23 Oct still kept
  });

  it("counts down the days left", () => {
    expect(daysLeft("2026-10-23", 30, today)).toBe(27);
    expect(daysLeft("2026-09-01", 30, today)).toBe(0);
  });
});
