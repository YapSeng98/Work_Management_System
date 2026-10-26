import { describe, expect, it } from "vitest";
import { normalize, parseBrief } from "./index";
import ownership from "./fixtures/ownership.txt?raw";
import daily from "./fixtures/daily.txt?raw";
import json from "./fixtures/json.txt?raw";
import ownershipV3 from "./fixtures/ownership-v3.txt?raw";

const titles = (b: ReturnType<typeof parseBrief>, owner: string) =>
  b.items.filter((i) => i.owner === owner).map((i) => i.title).sort();
const find = (b: ReturnType<typeof parseBrief>, title: string) => b.items.find((i) => i.title === title)!;

describe("ownership report (Section A / B / C)", () => {
  const b = parseBrief(ownership);

  it("is detected and keeps the AI's counts and bottom line", () => {
    expect(b.format).toBe("ownership");
    expect(b.date).toBeUndefined(); // no date in this sample's heading
    expect(parseBrief(ownership.replace("EXECUTIVE WORK BRIEF", "EXECUTIVE WORK BRIEF – 23 Oct 2026")).date?.getDate()).toBe(23);
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

describe("ownership report, newer layout (what changed, new emails, engagements)", () => {
  const b = parseBrief(ownershipV3);

  it("is detected without the SECTION A/B/C prefixes", () => {
    expect(b.format).toBe("ownership");
  });

  it("keeps the same mine/team split for the shared content", () => {
    const base = parseBrief(ownership);
    expect(titles(b, "me")).toEqual(expect.arrayContaining(titles(base, "me")));
    for (const t of titles(base, "team").filter((x) => x !== "Invoice Resubmission Bug")) expect(titles(b, "team")).toContain(t);
    expect(find(b, "Data Center Migration Risk").owner).toBe("team"); // not merged with the "data migration" engagement
  });

  it("lists what changed today and flags the items it names", () => {
    expect(b.changes).toEqual(["INC0044444 escalated by the customer this morning.", "New request from Globex about release timing."]);
    expect(find(b, "Invoice Resubmission Bug").changedToday).toBe(true);
    expect(find(b, "Payroll Export Failure").changedToday).toBeUndefined();
  });

  it("files new emails to note under FYI, never under waiting-on-customer", () => {
    expect(b.items.filter((i) => i.owner === "fyi" && !i.completed).map((i) => i.title).sort()).toEqual(["Vendor Security Advisory", "Year-End Support Roster"]);
    expect(find(b, "Year-End Support Roster").from).toBe("Service Desk");
    expect(titles(b, "others")).toEqual([]);
  });

  it("moves completed items out of every action list", () => {
    expect(find(b, "Release Checklist Sent")).toMatchObject({ owner: "fyi", completed: true });
    // listed by the team AND as completed (handed over) → completed wins
    expect(find(b, "Invoice Resubmission Bug")).toMatchObject({ owner: "fyi", completed: true });
  });

  it("never lets a completed listing take an item out of My Actions", () => {
    expect(titles(b, "me")).toEqual(expect.arrayContaining(["Payroll Export Failure", "ERP Release Questions", "ERP Report Extra Columns"]));
  });

  it("marks engagements and assigns them by their Owner field", () => {
    expect(find(b, "Globex Data Migration Review")).toMatchObject({ owner: "me", engagement: true });
    expect(find(b, "Globex Analytics Rollout")).toMatchObject({ owner: "team", engagement: true, ownerName: "Alex Lim" });
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

import priority from "./fixtures/priority.txt?raw";
import priorityJson from "./fixtures/priority-json.txt?raw";

describe("priority-section brief (Critical / High / Medium / Other / Waiting)", () => {
  describe("with the work_items JSON block", () => {
    const b = parseBrief(priorityJson);
    it("reads the JSON, with the date from the heading", () => {
      expect(b.format).toBe("json");
      expect(b.items).toHaveLength(6);
      expect(b.date?.getDate()).toBe(26);
      expect(b.counts.map((c) => c.label)).toEqual(["Critical", "High", "Medium", "Normal", "Waiting on customer"]);
    });
    it("maps P1–P4 and puts 'Waiting On Customer' items with others", () => {
      expect(b.items.find((i) => i.title.startsWith("INC0011111"))).toMatchObject({ owner: "me", priority: "critical", category: "Production incident", source: "Helpdesk folder", due: expect.any(String) });
      expect(b.items.find((i) => i.title.startsWith("RE: SR2222222"))?.priority).toBe("high");
      expect(b.items.find((i) => i.title.startsWith("Estimate"))?.priority).toBe("low");
      expect(b.items.find((i) => i.title.startsWith("INC0055555"))?.owner).toBe("others");
    });
    it("fills in details the sparse JSON leaves out, from the report text", () => {
      const payroll = b.items.find((i) => i.title.startsWith("INC0011111"))!;
      expect(payroll.summary).toContain("I own the payroll interface fix."); // "Why it needs my action"
      expect(payroll.summary).toContain("Risk if delayed: Payroll for 3,000 staff is delayed.");
      expect(payroll.escalation).toBe(true); // it sits under Critical Actions
      expect(b.items.find((i) => i.title.startsWith("RE: SR2222222"))?.summary).toContain("RCA was assigned to me.");
      expect(b.meetings.map((m) => m.when)).toEqual(["10:00 AM", "2:30 PM"]); // the JSON has no meetings
      expect(b.items).toHaveLength(6); // the JSON decides the list; nothing added from the text
    });

    it("takes the Top 5 ranks from the report text", () => {
      expect(b.items.find((i) => i.title.startsWith("INC0011111"))?.topRank).toBe(1);
      expect(b.items.find((i) => i.title.startsWith("RE: SR2222222"))?.topRank).toBe(2);
      expect(b.items.find((i) => i.title.startsWith("UAT sign-off"))?.topRank).toBe(3);
      expect(b.items.find((i) => i.title.startsWith("DS-202600123"))?.topRank).toBe(4);
      expect(b.items.find((i) => i.title.startsWith("Estimate"))?.topRank).toBe(5);
      expect(b.items[0].title).toMatch(/^INC0011111/);
    });
  });

  describe("without JSON (report text only)", () => {
    const b = parseBrief(priority);
    it("is detected and keeps counts", () => {
      expect(b.format).toBe("priority");
      expect(b.counts).toHaveLength(5);
      expect(b.date?.getDate()).toBe(26);
    });
    it("files each section with the right owner and priority", () => {
      expect(find(b, "Payroll export outage")).toMatchObject({ owner: "me", priority: "critical", escalation: true, topRank: 1, due: "Today", customer: "Acme Health / Payroll" });
      expect(find(b, "RCA for duplicate invoices")).toMatchObject({ owner: "me", priority: "high", topRank: 2 });
      expect(find(b, "UAT sign-off for release 4.2")).toMatchObject({ priority: "high", topRank: 3 });
      expect(find(b, "Internal estimate review")).toMatchObject({ priority: "low", topRank: 5 });
      expect(find(b, "Data correction batch")).toMatchObject({ owner: "others" });
    });
    it("merges summary-table rows into items and adds the rest by owner", () => {
      expect(find(b, "Decisions Support ticket DS-202600123")).toMatchObject({ owner: "me", stage: "Decisions Support", topRank: 4 });
      expect(b.items.find((i) => i.refs.includes("DS-202600456"))?.owner).toBe("others"); // waiting on vendor
      expect(b.items.find((i) => i.refs.includes("INC0077777"))).toMatchObject({ owner: "team", ownerName: "Alex Lim" });
      expect(b.items.filter((i) => i.refs.includes("INC0011111"))).toHaveLength(1); // summary row merged
    });
    it("lists today's meetings", () => {
      expect(b.meetings.map((m) => m.when)).toEqual(["10:00 AM", "2:30 PM"]);
      expect(b.meetings[0].title).toBe("Release 4.2 go/no-go");
    });
  });
});

describe("item ids are the same whichever layout a thread came from", () => {
  it("text-only and JSON versions of a brief give their shared items identical ids", () => {
    const text = parseBrief(priority);
    const json = parseBrief(priorityJson);
    const textIds = new Set(text.items.map((i) => i.id));
    for (const item of json.items) expect(textIds.has(item.id), item.title).toBe(true);
  });
  it("ids are unique within a brief, even when two items share a ticket", () => {
    const b = parseBrief('{"work_items": [ {"subject": "INC0099999: deploy the fix"}, {"subject": "INC0099999: send the RCA"} ]}');
    expect(new Set(b.items.map((i) => i.id)).size).toBe(2);
  });
  it("RE:/FW: prefixes and punctuation don't change an id", () => {
    const a = parseBrief('{"items": [ {"title": "x", "subject": "RE: FW: Release checklist!"} ]}').items[0].id;
    const b = parseBrief('{"items": [ {"title": "y", "subject": "release checklist"} ]}').items[0].id;
    expect(a).toBe(b);
  });
});
