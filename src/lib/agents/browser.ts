import type { LiveOutcome } from '../scan/checks';
import type { AgentDeps } from './headless';
import { setRunStatus } from './runLog';

/** Placeholder until Task 10 implements the browser agent. */
export async function runBrowserAgent(args: { runId: string; url: string; goal: string; deps: Omit<AgentDeps, 'fetchImpl'> }): Promise<LiveOutcome> {
  setRunStatus(args.runId, 'failed', 'Browser agent not available yet.');
  return 'not_run';
}
