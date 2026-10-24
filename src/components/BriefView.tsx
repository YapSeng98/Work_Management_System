import type { ReactNode } from "react";
import type { BriefItem, ParsedBrief } from "../lib/brief";
import { Card, SectionHeader } from "./Card";
import { BriefItemRow, type ItemStatus } from "./BriefItemRow";
import { MeetingsCard } from "./MeetingsCard";
import { StatTiles } from "./StatTiles";
import { FlagIcon, ReplyIcon, SparklesIcon, TargetIcon, UsersIcon } from "./icons";

export function BriefView({
  brief,
  hidden,
  statusOf,
  sinceOf,
  onTake,
  onDismiss,
}: {
  brief: ParsedBrief;
  hidden: (id: string) => boolean;
  statusOf: (item: BriefItem) => ItemStatus;
  sinceOf: (item: BriefItem) => string | undefined;
  onTake: (item: BriefItem) => void;
  onDismiss: (item: BriefItem) => void;
}) {
  const shared = { statusOf, sinceOf, onTake, onDismiss };
  const visible = brief.items.filter((i) => !hidden(i.id));
  const mine = visible.filter((i) => i.owner === "me");
  const team = visible.filter((i) => i.owner === "team");
  const chase = visible.filter((i) => i.owner === "others");
  const fyi = visible.filter((i) => i.owner === "fyi");
  const doToday = mine.filter((i) => i.quadrant === "do" && statusOf(i) !== "taken").length;

  return (
    <>
      <StatTiles
        tiles={[
          { value: String(doToday), label: "to do today", accent: true },
          { value: String(mine.length), label: "pending you" },
          ...(team.length ? [{ value: String(team.length), label: "owned by your team" }] : []),
          { value: String(chase.length), label: "waiting on others" },
          ...(brief.meetings.length ? [{ value: String(brief.meetings.length), label: "meetings" }] : []),
        ]}
      />

      {(brief.executiveSummary || brief.counts.length > 0) && (
        <Card ai>
          <SectionHeader ai icon={<SparklesIcon size={15} />} label="AI summary" />
          {brief.executiveSummary && <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text)" }}>{brief.executiveSummary}</div>}
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
      {fyi.length > 0 && (
        <ItemList icon={<FlagIcon size={15} />} label="FYI" hint="No action needed" items={fyi} empty="" statusOf={statusOf} sinceOf={sinceOf} />
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
  onTake,
  onDismiss,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  items: BriefItem[];
  empty: string;
  statusOf: (item: BriefItem) => ItemStatus;
  sinceOf: (item: BriefItem) => string | undefined;
  onTake?: (item: BriefItem) => void;
  onDismiss?: (item: BriefItem) => void;
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
            onTake={onTake && (() => onTake(item))}
            onDismiss={onDismiss && (() => onDismiss(item))}
          />
        ))}
        {items.length === 0 && <div style={{ fontSize: 14, color: "var(--text-faint)", padding: "4px 10px" }}>{empty}</div>}
      </div>
    </Card>
  );
}
