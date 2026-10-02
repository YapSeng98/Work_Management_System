import type { Digest } from "../types";
import { mockDigest } from "../data/mock";

/**
 * Stubbed integration layer for the morning digest (Outlook mail + calendar).
 * Returns mock data until the real source is decided — swap the body for a
 * real fetch() without touching call sites.
 */
export async function fetchDigest(): Promise<Digest> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockDigest;
}
