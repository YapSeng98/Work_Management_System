import { describe, expect, it } from "vitest";
import { DATA_SECTION_MARKER, PROMPT_TEMPLATE, hasDataSection, withDataSection } from "./prompt";
import { AI_INSTRUCTIONS } from "./brief";

describe("saved prompt helpers", () => {
  it("the template already asks for the app's data section", () => {
    expect(hasDataSection(PROMPT_TEMPLATE)).toBe(true);
    expect(AI_INSTRUCTIONS).toContain(DATA_SECTION_MARKER);
  });
  it("adds the data section once, never twice", () => {
    const once = withDataSection("My prompt.");
    expect(once.startsWith("My prompt.\n\n")).toBe(true);
    expect(withDataSection(once)).toBe(once);
  });
  it("the template carries only placeholders, no personal details", () => {
    expect(PROMPT_TEMPLATE).toMatch(/<YOUR NAME>/);
    expect(PROMPT_TEMPLATE).not.toMatch(/@|\b\d{7,}\b/);
  });
});
