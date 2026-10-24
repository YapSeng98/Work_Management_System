import { describe, expect, it } from "vitest";
import { normalize, parseBrief } from "./index";
import ownership from "./fixtures/ownership.txt?raw";
import daily from "./fixtures/daily.txt?raw";
import json from "./fixtures/json.txt?raw";

const titles = (b: ReturnType<typeof parseBrief>, owner: string) =>
  b.items.filter((i) => i.owner === owner).map((i) => i.title).sort();
const find = (b: ReturnType<typeof parseBrief>, title: string) => b.items.find((i) => i.title === title)!;

describe("ownership report (Section A / B / C)", () => {
  const b = parseBrief(ownership);

  it("is detected and keeps the AI's counts and bottom line", () => {
    expect(b.format).toBe("ownership");
    expect(b.counts).toHaveLength(5);
    expect(b.counts[0]).toEqual({ label: "My Actions", value: 3 });
    expect(b.executiveSummary).toMatch(/^Three items need Jane Tan/);
  });

  it("puts exactly the Section A items under 'pending you'", () => {
    expect(titles(b, "me")).toEqual(["ERP Release Questions", "ERP Report Extra Columns", "Payroll Export Failure"]);
  });

  it("keeps colleagues' items with the team, never as mine", () => {
    expect(titles(b, "team")).toEqual([
      "Data Center Migration Risk",
      "Invoice Resubmission Bug",
      "Mobile App Upload Enhancement",
      "Warehouse Onboarding / New Site Code",
    ]);
    expect(find(b, "Warehouse Onboarding / New Site Code").ownerName).toBe("Alex Lim");
  });

  it("merges every mention of an item into one", () => {
    expect(b.items).toHaveLength(7);
    const payroll = find(b, "Payroll Export Failure");
    expect(payroll.topRank).toBe(1); // Top 10 row by ticket
    expect(payroll.waitingOnCustomer).toBe(true); // also in Section C
    expect(payroll.priority).toBe("critical");
    expect(payroll.due).toBe("Today");
    expect(find(b, "ERP Release Questions").topRank).toBe(2);
    expect(find(b, "ERP Report Extra Columns").topRank).toBe(3); // keyword match, no ticket
    expect(find(b, "ERP Report Extra Columns").risk).toBe("medium"); // aging line merged in
    const invoice = find(b, "Invoice Resubmission Bug");
    expect(invoice.escalation).toBe(true); // escalation merged by keywords
    expect(invoice.topRank).toBe(4);
    expect(find(b, "Mobile App Upload Enhancement").topRank).toBe(5); // single acronym "MAU"
    expect(find(b, "Warehouse Onboarding / New Site Code").waitingOnCustomer).toBe(true);
  });

  it("never merges two real items on one shared acronym (ERP)", () => {
    expect(find(b, "ERP Release Questions").refs).toEqual(["SR2222222", "IN3333333"]);
    expect(find(b, "ERP Report Extra Columns").refs).toEqual([]);
  });

  it("carries suggested replies and orders 'mine' by the AI's Top 10", () => {
    const mine = b.items.filter((i) => i.owner === "me");
    expect(mine.every((i) => i.suggestedReply)).toBe(true);
    expect(mine.map((i) => i.topRank)).toEqual([1, 2, 3]);
  });

  it("gives every item a stable id", () => {
    expect(parseBrief(ownership).items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(new Set(b.items.map((i) => i.id)).size).toBe(b.items.length);
  });
});

describe("copy formatting doesn't change the result", () => {
  const sig = (t: string) => {
    const b = parseBrief(t);
    return b.items.map((i) => `${i.owner}|${i.title}|${i.topRank ?? ""}|${i.suggestedReply ? "r" : ""}`).sort().join("\n");
  };
  const ref = sig(ownership);
  const heading = (l: string) => /^(🔴|🟠|🟢|🚨|⚠|📅)|^EXECUTIVE (SUMMARY|RECOMMENDATION)$/.test(l.trim());

  it.each([
    ["Windows line endings", ownership.replace(/\n/g, "\r\n")],
    [
      "markdown headings, bullets and bold labels",
      ownership
        .split("\n")
        .map((l) => {
          const t = l.trim();
          if (heading(t)) return `## ${t}`;
          if (/^(CRITICAL|HIGH|MEDIUM)$/.test(t)) return `### ${t}`;
          const f = t.match(/^([A-Z][A-Za-z ?/'()&-]{1,48}?):\s*(.*)$/);
          if (f) return `- **${f[1]}:** ${f[2]}`;
          return /^\d+\. /.test(t) ? `**${t}**` : l;
        })
        .join("\n"),
    ],
    ["• bullets", ownership.split("\n").map((l) => (/^\s*[A-Z][A-Za-z ?/'()&-]{1,48}?:/.test(l) ? `• ${l.trim()}` : l)).join("\n")],
    [
      "Title-case headings",
      ownership
        .split("\n")
        .map((l) => (heading(l.trim()) ? l.trim().replace(/[A-Z]+/g, (w) => w[0] + w.slice(1).toLowerCase()) : l))
        .join("\n"),
    ],
  ])("%s", (_name, variant) => {
    expect(sig(variant)).toBe(ref);
  });

  it("normalize() strips markdown but leaves table rows and '#' headers alone", () => {
    expect(normalize("- **Owner:** Jane")).toBe("Owner: Jane");
    expect(normalize("## 🔴 SECTION A")).toBe("🔴 SECTION A");
    expect(normalize("#\tTask\tTicket")).toBe("#\tTask\tTicket");
    expect(normalize("| a | b |")).toBe("| a | b |");
  });
});

describe("daily brief (emoji sections)", () => {
  const b = parseBrief(daily);
  it("sorts by owner and keeps meetings and FYI", () => {
    expect(b.format).toBe("daily");
    expect(titles(b, "me")).toHaveLength(2);
    expect(titles(b, "others")).toEqual(["RE: INC0044444 - Invoice resubmission failing"]);
    expect(b.meetings).toHaveLength(1);
    expect(b.items.find((i) => i.owner === "fyi")).toBeTruthy();
    expect(b.items[0].topRank).toBe(1);
  });
});

describe("JSON block", () => {
  const b = parseBrief(json);
  it("is preferred and read exactly", () => {
    expect(b.format).toBe("json");
    expect(b.items).toHaveLength(4);
    expect(b.meetings).toEqual([expect.objectContaining({ title: "ERP review" })]);
    const payroll = b.items[0];
    expect(payroll).toMatchObject({ owner: "me", topRank: 1, due: "Today", escalation: true, suggestedReply: "Root cause found; fix tomorrow." });
  });
  it("maps my_team to the team and tolerates loose types", () => {
    expect(b.items.find((i) => i.title === "Finalise warehouse quote")).toMatchObject({ owner: "team", ownerName: "Alex Lim" });
    expect(b.items.find((i) => i.title === "Get UAT sign-off")).toMatchObject({ owner: "others", refs: ["INC0044444"], topRank: 3 });
    expect(b.items.find((i) => i.title === "Data correction done")?.owner).toBe("fyi");
  });
});

describe("bad input", () => {
  it.each(["", "   \n\t", "hello world\nnot a brief", '{"items": [ broken'])("finds nothing in %j", (t) => {
    const b = parseBrief(t);
    expect(b.items).toHaveLength(0);
    expect(b.meetings).toHaveLength(0);
  });
  it("handles a very large paste quickly", () => {
    const t0 = performance.now();
    const b = parseBrief(ownership.repeat(150));
    expect(b.items).toHaveLength(7);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
