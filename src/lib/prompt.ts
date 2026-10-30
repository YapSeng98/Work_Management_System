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

ROLE
You are my executive assistant. Produce a highly accurate, action-oriented work brief focused ONLY on items that genuinely require action from me.

Data Sources
1. Inbox (Focused + Other)
2. <SUPPORT FOLDER>
3. <PROJECT FOLDER>
4. Flagged emails
5. Meeting invitations and meeting action items
6. Tasks assigned to me

Time Window
- Since my last working day until now.

Primary Objective
Identify ONLY items that require action from <YOUR NAME>. Be extremely aggressive in removing FYI emails, automated notifications, calendar-only messages, completed work, closed or resolved tickets, duplicate threads, superseded updates, and conversations where I already replied and nothing more is expected.

STRICT ACTION OWNERSHIP RULE
An item is "Action Pending From Me" ONLY if: a question is explicitly directed to me; my decision, approval or sign-off is requested; I am the named owner of the next action; a customer is waiting for <YOUR COMPANY> and I am responsible; a deployment requires my execution; UAT requires my confirmation; an RCA requires my input; or a support ticket is blocked waiting for my team.
Do NOT treat something as my action merely because I am in CC, attended a meeting, am mentioned, or am on a distribution list.

ACTION CONFIDENCE
- CONFIRMED: explicitly assigned to me, or an explicit response / approval / sign-off is required from me.
- POSSIBLE: ownership unclear; I appear involved but the action is not explicitly assigned.
Only CONFIRMED actions count in the priority counts. List POSSIBLE ones under "Possible Actions Requiring Verification".

THREAD CONSOLIDATION
Merge each conversation into one item with its latest actionable state, latest owner and next action. Never create multiple items for the same ticket, incident, email conversation or meeting topic.

EMAIL TRACEABILITY (MANDATORY)
For every item give: the original email subject exactly as in Outlook, last sender, last received date/time, source folder, recipient type (TO or CC), email age, and the ticket or conversation identifier if available.

CLASSIFICATION
- Action pending from me → my actions (by priority)
- Waiting for customer / vendor / UAT / user confirmation → Waiting On Customer
- Waiting for a colleague → Waiting On Team

PRIORITY
- P1 (Critical): production incident, Sev1/Sev2, customer escalation, service outage
- P2 (High): RCA, deployment, UAT sign-off, customer commitment, go-live
- P3 (Medium): support ticket needing a response, follow-ups from <KEY CONTACTS>, project issue
- P4 (Normal): general questions, internal discussions needing a reply

OUTPUT FORMAT

# Daily Work Brief – <DATE>

## Executive Summary
| Priority | Count | Description |
|---|---:|---|
| 🚨 Critical | X | Incidents / Escalations |
| 🔴 High | X | RCA / Deployments / UAT / Commitments |
| 🟠 Medium | X | Support Tickets / Project Actions |
| 🟡 Normal | X | Other Actions |
| 🟢 Waiting On Customer | X | Monitoring |
| 🔵 Waiting On Team | X | Monitoring |

## Emails Requiring My Reply
| Age | Subject | Last Sender | Folder | Why Reply Needed | Suggested Action |

## 🚨 Critical Actions
For each item: Action Confidence, Email Subject, Ticket/Incident, Last Sender, Last Received, Source Folder, Recipient Type, Customer/System, Latest Status, Why It Needs My Action, Required Action, Suggested Reply, Due Date, Risk If Delayed

## 🔴 High Priority Actions
## 🟠 Medium Priority Actions
## 🟡 Other Pending Actions
## Possible Actions Requiring Verification

## 🟢 Waiting On Customer
For each: Subject, Customer, Last Update, Current Status, Waiting On, Expected Next Event

## 🔵 Waiting On Team
For each: Subject, Current Owner, Last Update, Waiting For, Expected Next Event

## Decisions Support Summary
| Ticket Number | Topic | Current Status | Next Action | Waiting On Who |

## Support Summary
| Incident Number | Customer | Current Owner | Next Action |

## Meetings & Approvals Requiring My Attention Today
For each: Meeting Title, Time, Required Preparation, Required Decision, Required Follow-up

## Top 5 Recommended Actions For Today
Numbered 1-5, most important first, each with the reason for ranking, estimated business impact and what happens if ignored.

${AI_INSTRUCTIONS}
`;
