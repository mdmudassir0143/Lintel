import crypto from 'node:crypto';
import { getDb } from '../db';

export type RunStatus = 'running' | 'awaiting_approval' | 'succeeded' | 'failed';
export interface RunRow {
  id: string; scan_id: string | null; merchant_id: string | null; kind: 'headless' | 'browser'; goal: string;
  status: RunStatus; summary: string | null; live_view_url: string | null; created_at: number;
}
export interface StepRow { idx: number; action: string; detail: any; screenshot: string | null; created_at: number }

export function createRun(r: { kind: 'headless' | 'browser'; goal: string; scanId?: string; merchantId?: string }): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(`insert into runs (id, scan_id, merchant_id, kind, goal, status, created_at) values (?, ?, ?, ?, ?, 'running', ?)`)
    .run(id, r.scanId ?? null, r.merchantId ?? null, r.kind, r.goal, Date.now());
  return id;
}

export function addStep(runId: string, action: string, detail: unknown, screenshot?: string): void {
  const db = getDb();
  const { n } = db.prepare('select count(*) n from steps where run_id = ?').get(runId) as { n: number };
  db.prepare('insert into steps (run_id, idx, action, detail, screenshot, created_at) values (?, ?, ?, ?, ?, ?)').run(
    runId, n, action, JSON.stringify(detail ?? null), screenshot ?? null, Date.now(),
  );
}

export function setRunStatus(runId: string, status: RunStatus, summary?: string): void {
  if (summary === undefined) getDb().prepare('update runs set status = ? where id = ?').run(status, runId);
  else getDb().prepare('update runs set status = ?, summary = ? where id = ?').run(status, summary, runId);
}

export function setLiveViewUrl(runId: string, url: string): void {
  getDb().prepare('update runs set live_view_url = ? where id = ?').run(url, runId);
}

export function getRun(runId: string, opts: { screenshots?: boolean } = { screenshots: true }): { run: RunRow; steps: StepRow[] } | null {
  const db = getDb();
  const run = db.prepare('select * from runs where id = ?').get(runId) as RunRow | undefined;
  if (!run) return null;
  const cols = opts.screenshots ? 'idx, action, detail, screenshot, created_at' : 'idx, action, detail, null as screenshot, created_at';
  const steps = (db.prepare(`select ${cols} from steps where run_id = ? order by idx`).all(runId) as any[]).map((s) => ({ ...s, detail: JSON.parse(s.detail) }));
  return { run, steps };
}

export type RunListItem = Pick<RunRow, 'id' | 'scan_id' | 'kind' | 'goal' | 'status' | 'summary' | 'created_at'>;

/** A merchant's most recent agent runs, newest first (no live-view URLs). */
export function latestRuns(merchantId: string, limit = 10): RunListItem[] {
  return getDb()
    .prepare('select id, scan_id, kind, goal, status, summary, created_at from runs where merchant_id = ? order by created_at desc limit ?')
    .all(merchantId, limit) as RunListItem[];
}

/** Marks a run failed with a summary a merchant can read; the raw error goes to the step log. */
export function failRun(runId: string, e: unknown): void {
  const err = e as { name?: string; message?: string };
  addStep(runId, 'error', { message: String(err?.message ?? e) });
  const summary = err?.name === 'LlmUnavailableError'
    ? 'The AI model was busy, so the agent stopped. Send it again in a minute.'
    : 'The agent hit an unexpected error and stopped. Send it again.';
  setRunStatus(runId, 'failed', summary);
}
