import { parseDailyBrief } from "./dailyFormat";
import { looksLikeExecutiveBrief, parseExecutiveBrief } from "./execFormat";
import { extractBriefJson, parseJsonBrief } from "./jsonFormat";
import type { ParsedBrief } from "./types";

export type { BriefItem, BriefMeeting, ItemKind, Owner, ParsedBrief, Priority } from "./types";

/**
 * Analyse pasted brief text. Prefers the machine-readable JSON block when present
 * (most reliable), then the executive report layout, then the older daily layout.
 * Runs entirely in the browser.
 */
export function parseBrief(text: string): ParsedBrief {
  const json = extractBriefJson(text);
  if (json) return parseJsonBrief(json);
  if (looksLikeExecutiveBrief(text)) return parseExecutiveBrief(text);
  return parseDailyBrief(text);
}

/**
 * Appended to the user's own AI prompt so the report ends with data this app can
 * read exactly. Kept generic — no names or company details.
 */
export const AI_INSTRUCTIONS = `==================================================
MACHINE-READABLE DATA (for my Daily Brief app)
==================================================

After the report, output ONE \`\`\`json code block. Include every distinct work item from the report EXACTLY ONCE — merge mentions of the same ticket or email thread from different sections into one item. Use exactly this structure and only the listed values:

{
  "brief_date": "YYYY-MM-DD",
  "bottom_line": "1-2 sentence summary of what matters most today",
  "counts": { "need_my_reply": 0, "waiting_on_me": 0, "waiting_on_customer": 0, "uat_pending": 0, "deployment_pending": 0, "escalations": 0, "high_risk": 0 },
  "items": [
    {
      "title": "Short task title starting with a verb",
      "subject": "Original email subject",
      "tickets": ["INC0000000"],
      "customer": "Customer or team",
      "from": "Person who is waiting / sender",
      "waiting_on": "me | my_team | customer | third_party | none",
      "type": "reply | action | decision | follow_up | fyi",
      "stage": "investigation | rca | design | validation | uat | deployment | closure | other",
      "status": "Current status in one line",
      "next_action": "The next concrete step",
      "due": "YYYY-MM-DD or null",
      "waiting_since": "YYYY-MM-DD or null",
      "urgency": "critical | high | medium | low",
      "risk": "critical | high | medium | low",
      "escalation": true,
      "top_rank": 1
    }
  ],
  "meetings": [ { "when": "YYYY-MM-DD HH:MM", "title": "Meeting title" } ]
}

Rules: "waiting_on" is "me" when I personally must act, "my_team" when my company owes the next step, "customer" or "third_party" when we are waiting on them. "top_rank" is the item's position in TODAY'S TOP 10 PRIORITIES, or null. Use null for unknown dates. Output valid JSON only inside the code block.`;
