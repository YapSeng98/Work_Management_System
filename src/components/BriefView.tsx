import type { BriefItem, ParsedBrief } from "../lib/briefParser";
import { Card, SectionHeader } from "./Card";
import { BriefItemRow, type ItemStatus } from "./BriefItemRow";
import { MeetingsCard } from "./MeetingsCard";
import { StatTiles } from "./StatTiles";
import { FlagIcon, ListChecksIcon, MailIcon, ReplyIcon } from "./icons";

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
  const shared = { statusOf, sinceOf };
  const visible = brief.items.filter((i) => !hidden(i.id));
  const mine = visible.filter((i) => i.owner === "me");
  const chase = visible.filter((i) => i.owner === "others");
  const fyi = visible.filter((i) => i.owner === "fyi");
  const doToday = mine.filter((i) => i.quadrant === "do" && statusOf(i) !== "taken").length;

  return (
    <>
      <StatTiles
        tiles={[
          { value: String(doToday), label: "to do today", accent: true },
          { value: String(mine.length), label: "pending you" },
          { value: String(chase.length), label: "to chase" },
          { value: String(brief.meetings.length), label: "meetings" },
        ]}
      />

      {brief.executiveSummary && (
        <Card>
          <SectionHeader icon={<MailIcon size={14} />} label="Summary" />
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>{brief.executiveSummary}</div>
        </Card>
      )}

      <ItemList
        icon={<ListChecksIcon />}
        label="Pending you — most important first"
        items={mine}
        empty="Nothing pending you."
        {...shared}
        onTake={onTake}
        onDismiss={onDismiss}
      />
      <ItemList
        icon={<ReplyIcon />}
        label="Waiting on others — chase / follow up"
        items={chase}
        empty="Nobody to chase."
        {...shared}
        onTake={onTake}
        onDismiss={onDismiss}
      />
      {brief.meetings.length > 0 && (
        <MeetingsCard meetings={brief.meetings.map((m) => ({ id: m.id, time: m.when, title: m.title }))} />
      )}
      {fyi.length > 0 && (
        <ItemList icon={<FlagIcon />} label="FYI — no action" items={fyi} empty="" {...shared} />
      )}
    </>
  );
}

function ItemList({
  icon,
  label,
  items,
  empty,
  statusOf,
  sinceOf,
  onTake,
  onDismiss,
}: {
  icon: React.ReactNode;
  label: string;
  items: BriefItem[];
  empty: string;
  statusOf: (item: BriefItem) => ItemStatus;
  sinceOf: (item: BriefItem) => string | undefined;
  onTake?: (item: BriefItem) => void;
  onDismiss?: (item: BriefItem) => void;
}) {
  return (
    <Card>
      <SectionHeader
        icon={icon}
        label={label}
        right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{items.length}</span>}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((item, i) => (
          <BriefItemRow
            key={item.id}
            item={item}
            isLast={i === items.length - 1}
            status={statusOf(item)}
            since={sinceOf(item)}
            onTake={onTake && (() => onTake(item))}
            onDismiss={onDismiss && (() => onDismiss(item))}
          />
        ))}
        {items.length === 0 && <div style={{ fontSize: 14, color: "var(--text-faint)", padding: "6px 0" }}>{empty}</div>}
      </div>
    </Card>
  );
}
