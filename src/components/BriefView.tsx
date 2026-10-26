import type { ReactNode } from "react";
import type { BriefItem, ParsedBrief } from "../lib/brief";
import type { TakeEdit } from "../lib/planner";
import type { CarriedItem } from "../lib/carryOver";
import { Card, SectionHeader } from "./Card";
import { BriefItemRow, type ItemStatus } from "./BriefItemRow";
import { MeetingsCard } from "./MeetingsCard";
import { StatTiles } from "./StatTiles";
import { CheckIcon, ClockIcon, FlagIcon, ReplyIcon, SparklesIcon, TargetIcon, UsersIcon } from "./icons";

export function BriefView({
  brief,
  hidden,
  statusOf,
  sinceOf,
  onTake,
  onDismiss,
  onComplete,
  carried = [],
}: {
  brief: ParsedBrief;
  carried?: CarriedItem[];
  hidden: (id: string) => boolean;
  statusOf: (item: BriefItem) => ItemStatus;
  sinceOf: (item: BriefItem) => string | undefined;
  onTake: (item: BriefItem, edit?: TakeEdit) => void;
  onDismiss: (item: BriefItem) => void;
  onComplete: (item: BriefItem) => void;
}) {
  const shared = { statusOf, sinceOf, onTake, onDismiss, briefTitle: brief.title };
  const visible = brief.items.filter((i) => !hidden(i.id));
  const mine = visible.filter((i) => i.owner === "me");
  const team = visible.filter((i) => i.owner === "team");
  const chase = visible.filter((i) => i.owner === "others");
  const fyi = visible.filter((i) => i.owner === "fyi" && !i.completed);
  const completed = visible.filter((i) => i.completed);
  const doToday = mine.filter((i) => i.quadrant === "do" && statusOf(i) !== "taken").length;

  return (
    <>
      <StatTiles
        tiles={[
          { value: String(doToday), label: "to do today", accent: true },
          { value: String(mine.length), label: "pending you" },
          ...(carried.length ? [{ value: String(carried.length), label: "carried over" }] : []),
          ...(team.length ? [{ value: String(team.length), label: "owned by your team" }] : []),
          { value: String(chase.length), label: "waiting on others" },
          ...(brief.meetings.length ? [{ value: String(brief.meetings.length), label: "meetings" }] : []),
        ]}
      />

      {(brief.executiveSummary || brief.counts.length > 0 || (brief.changes?.length ?? 0) > 0) && (
        <Card ai>
          <SectionHeader ai icon={<SparklesIcon size={15} />} label="AI summary" />
          {brief.executiveSummary && <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text)" }}>{brief.executiveSummary}</div>}
          {brief.changes && brief.changes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>What changed today</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3, fontSize: 13.5, color: "var(--text)" }}>
                {brief.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.counts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {brief.counts.map((c) => (
                <span key={c.label} className="chip" style={{ background: "var(--card-solid)", color: "var(--text-muted)", border: "1px solid var(--border)", fontWeight: 500 }}>
                  {c.label}
                  <strong style={{ color: "var(--text)" }}>{c.value}</strong>
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      <ItemList
        icon={<TargetIcon size={15} />}
        label="Pending you"
        hint="Most important first — Take sends it to your Planner"
        items={mine}
        empty="Nothing pending you. 🎉"
        {...shared}
      />
      {carried.length > 0 && (
        <Card>
          <SectionHeader
            icon={<ClockIcon size={15} />}
            label="Carried over"
            hint="Yours in an earlier brief, not taken or dismissed, and not mentioned today"
            count={carried.length}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
            {carried.map(({ item, fromDate }) => (
              <BriefItemRow
                key={item.id}
                item={item}
                status={statusOf(item)}
                since={sinceOf(item)}
                briefTitle={brief.title}
                carriedFrom={new Date(fromDate + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                onTake={(edit) => onTake(item, edit)}
                onDismiss={() => onDismiss(item)}
              />
            ))}
          </div>
        </Card>
      )}
      {team.length > 0 && (
        <ItemList
          icon={<UsersIcon size={15} />}
          label="Owned by your team"
          hint="Not your task — monitor, or Take to follow up"
          items={team}
          empty=""
          {...shared}
        />
      )}
      <ItemList
        icon={<ReplyIcon size={15} />}
        label="Waiting on others"
        hint="Customer or third party has the next move — chase if needed"
        items={chase}
        empty="Nobody to chase."
        {...shared}
      />
      {brief.meetings.length > 0 && (
        <MeetingsCard meetings={brief.meetings.map((m) => ({ id: m.id, time: m.when, title: m.title }))} />
      )}
      {completed.length > 0 && (
        <ItemList
          icon={<CheckIcon size={15} />}
          label="Completed — no longer your action"
          hint="Still open in your Planner? Mark it done here."
          items={completed}
          empty=""
          statusOf={statusOf}
          sinceOf={sinceOf}
          briefTitle={brief.title}
          onComplete={onComplete}
        />
      )}
      {fyi.length > 0 && (
        <ItemList icon={<FlagIcon size={15} />} label="FYI — worth noting" hint="No action needed" items={fyi} empty="" statusOf={statusOf} sinceOf={sinceOf} briefTitle={brief.title} />
      )}
    </>
  );
}

function ItemList({
  icon,
  label,
  hint,
  items,
  empty,
  statusOf,
  sinceOf,
  briefTitle,
  onTake,
  onDismiss,
  onComplete,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  items: BriefItem[];
  empty: string;
  statusOf: (item: BriefItem) => ItemStatus;
  sinceOf: (item: BriefItem) => string | undefined;
  briefTitle?: string;
  onTake?: (item: BriefItem, edit?: TakeEdit) => void;
  onDismiss?: (item: BriefItem) => void;
  onComplete?: (item: BriefItem) => void;
}) {
  return (
    <Card>
      <SectionHeader icon={icon} label={label} hint={hint} count={items.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
        {items.map((item) => (
          <BriefItemRow
            key={item.id}
            item={item}
            status={statusOf(item)}
            since={sinceOf(item)}
            briefTitle={briefTitle}
            onTake={onTake && ((edit) => onTake(item, edit))}
            onDismiss={onDismiss && (() => onDismiss(item))}
            onComplete={onComplete && (() => onComplete(item))}
          />
        ))}
        {items.length === 0 && <div style={{ fontSize: 14, color: "var(--text-faint)", padding: "4px 10px" }}>{empty}</div>}
      </div>
    </Card>
  );
}
