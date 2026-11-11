import { createRun, setRunStatus, failRun } from './runLog';
import { runHeadlessAgent, DEFAULT_GOAL } from './headless';
import { updateLiveAgentResult } from '../scan/runScan';
import { paypal } from '../server/paypal';
import { env } from '../env';
import type { LiveOutcome } from '../scan/checks';

export type AgentKind = 'headless' | 'browser';

export async function runAgent(kind: AgentKind, runId: string, url: string, goal: string): Promise<LiveOutcome> {
  const deps = { paypal: paypal(), approvalTimeoutMs: env.approvalTimeoutMs };
  if (kind === 'browser') {
    const { runBrowserAgent } = await import('./browser');
    return runBrowserAgent({ runId, url, goal, deps });
  }
  return runHeadlessAgent({ runId, url, goal, deps });
}

/** Creates a run and executes it in the background; feeds the result into the scan score. */
export function startRun(r: { kind: AgentKind; url: string; goal?: string; scanId?: string; merchantId?: string }): string {
  const goal = r.goal?.trim() || DEFAULT_GOAL.replace('{url}', r.url);
  const runId = createRun({ kind: r.kind, goal, scanId: r.scanId, merchantId: r.merchantId });
  void runAgent(r.kind, runId, r.url, goal)
    .then((outcome) => {
      if (r.scanId) updateLiveAgentResult(r.scanId, outcome, `${r.kind} agent run`);
    })
    .catch((e) => failRun(runId, e));
  return runId;
}
