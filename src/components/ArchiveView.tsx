import { useMemo, useState } from "react";
import type { BriefItem, Owner } from "../lib/brief";
import type { TakeEdit } from "../lib/planner";
import { daysLeft, type CarriedItem } from "../lib/carryOver";
import { Card, SectionHeader } from "./Card";
import { BriefItemRow, type ItemStatus } from "./BriefItemRow";
import { ClockIcon } from "./icons";

const FILTERS: { id: "all" | Owner; label: string }[] = [
  { id: "all", label: "All" },
  { id: "me", label: "Mine" },
  { id: "team", label: "Team" },
  { id: "others", label: "Others" },
];

/**
 * Every earlier item today's brief no longer mentions — kept 30 days, then deleted with its
 * brief. Anything here can still be taken into your Planner, whoever owned it.
 */
export function ArchiveView({
  archived,
  keepDays,
  dismissed,
  statusOf,
  sinceOf,
  onTake,
}: {
  archived: CarriedItem[];
  keepDays: number;
  dismissed: Set<string>;
  statusOf: (item: BriefItem) => ItemStatus;
  sinceOf: (item: BriefItem) => string | undefined;
  onTake: (item: BriefItem, edit?: TakeEdit) => void;
}) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<"all" | Owner>("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = archived.filter(({ item }) => {
      if (owner !== "all" && item.owner !== owner) return false;
      if (!q) return true;
      return [item.title, item.summary, item.customer, item.status, item.action, item.ownerName, ...item.refs]
        .filter(Boolean)
        .some((t) => t!.toLowerCase().includes(q));
    });
    const byDate = new Map<string, CarriedItem[]>();
    for (const c of shown) byDate.set(c.fromDate, [...(byDate.get(c.fromDate) ?? []), c]);
    return [...byDate.entries()];
  }, [archived, query, owner]);

  const shownCount = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <>
      <Card>
        <SectionHeader
          icon={<ClockIcon size={15} />}
          label={archived.length ? `Archive · ${archived.length}` : "Archive"}
          hint={`Items from earlier briefs that today's brief no longer mentions. Kept ${keepDays} days, then deleted automatically. Take any of them to make it yours.`}
        />
        <input
          className="input"
          type="search"
          placeholder="Search title, customer, ticket…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the archive"
        />
        <div className="tabs" role="group" aria-label="Filter by owner (Others = waiting on customer or third party)" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`tab${owner === f.id ? " tab--active" : ""}`}
              aria-pressed={owner === f.id}
              title={f.id === "others" ? "Waiting on customer or third party" : undefined}
              onClick={() => setOwner(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {groups.map(([date, list]) => {
        const left = daysLeft(date, keepDays);
        const label = new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
        return (
          <Card key={date}>
            <SectionHeader
              icon={<ClockIcon size={15} />}
              label={`${label} brief`}
              hint={left > 0 ? `Deletes in ${left} day${left === 1 ? "" : "s"}` : "Deletes today"}
              count={list.length}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
              {list.map(({ item, fromTitle }) => (
                <BriefItemRow
                  key={item.id}
                  item={item}
                  status={statusOf(item)}
                  since={sinceOf(item)}
                  briefTitle={fromTitle}
                  wasDismissed={dismissed.has(item.id)}
                  onTake={(edit) => onTake(item, edit)}
                />
              ))}
            </div>
          </Card>
        );
      })}

      {shownCount === 0 && (
        <Card>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {archived.length
              ? "Nothing matches this search or filter."
              : "Nothing archived yet. When a new brief no longer mentions an item, it moves here for " + keepDays + " days."}
          </div>
        </Card>
      )}
    </>
  );
}
