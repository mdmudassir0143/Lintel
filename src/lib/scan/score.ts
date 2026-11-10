import type { CheckResult } from './checks';

const FACTOR = { pass: 1, partial: 0.5, fail: 0 } as const;

export function score(checks: CheckResult[]): number {
  return Math.round(checks.reduce((s, c) => s + (c.earned ?? c.weight * FACTOR[c.status]), 0));
}
