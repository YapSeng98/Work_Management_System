import { AI_INSTRUCTIONS } from "./brief";

/** Marker the app looks for to know a prompt already asks for its JSON section. */
export const DATA_SECTION_MARKER = "MACHINE-READABLE JSON";

export function hasDataSection(prompt: string) {
  return prompt.includes(DATA_SECTION_MARKER) || /"items"\s*:\s*\[/.test(prompt);
}

export function withDataSection(prompt: string) {
  return hasDataSection(prompt) ? prompt : `${prompt.trimEnd()}\n\n${AI_INSTRUCTIONS}\n`;
}

/**
 * Starter prompt shown until the user saves their own. Deliberately generic: the site is
 * public, so personal names, customers and folders are placeholders to fill in.
 */
export const PROMPT_TEMPLATE = `Generate my Daily Work Brief.

Data Sources
1. Inbox (Focused + Other)
2. <SUPPORT FOLDER>
3. <PROJECT / DECISIONS FOLDER>
4. Flagged emails
5. Meeting invitations and meeting action items

Time Window
- Since my last working day until now.

Primary Objective
Identify ONLY items that require action from <YOUR NAME>. Be aggressive in removing noise, duplicate threads, FYI messages and closed tickets.

Include ONLY
- Emails awaiting my reply, decision, approval or sign-off
- Tasks and meeting action items assigned to me
- Customer questions directed to me
- Deployments I must execute, UAT I must validate, RCAs needing my input
- Support tickets that need a response from <YOUR COMPANY>

Exclude
- FYI emails, automated notifications, calendar-only notices
- Closed tickets and resolved incidents
- Threads where I already replied and nothing more is expected
- Duplicates and older messages superseded by newer replies

Thread Consolidation
For each conversation: merge the thread, keep only the latest actionable state, the latest owner and the next action.

Classification
- Action pending from me → My actions (by priority below)
- Waiting for customer / vendor / user / UAT, or a solution was given and confirmation is pending → Waiting On Customer

Priority
- P1: production incident, Sev1/Sev2, customer escalation, outage
- P2: RCA, deployment, UAT sign-off, customer commitments due
- P3: support tickets needing a response, follow-ups from <KEY CONTACTS>
- P4: general questions, internal discussions needing a reply

Output Format

# Daily Work Brief – <DATE>

## Executive Summary
| Priority | Count | Description |
|---|---|---|
| 🚨 Critical | X | Incidents / Escalations |
| 🔴 High | X | RCA / Deployments / UAT / Commitments |
| 🟠 Medium | X | Support Tickets / Project tickets |
| 🟡 Normal | X | Other Actions |
| 🟢 Waiting On Customer | X | Monitoring |

## 🚨 Critical Actions
For each item: Subject, Customer/System, Latest Status, Why it needs my action, Required Action, Due Date, Risk if delayed

## 🔴 High Priority Actions
## 🟠 Medium Priority Actions
## 🟡 Other Pending Actions
## 🟢 Waiting On Customer

## Decisions Support Summary
| Ticket Number | Topic | Current Status | Next Action | Waiting On Who |

## Support Summary
| Incident Number | Customer | Current Owner | Next Action |

## Meetings & Approvals Requiring My Attention Today

## Top 5 Recommended Actions For Today

${AI_INSTRUCTIONS}
`;
