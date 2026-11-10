import crypto from 'node:crypto';
import { getDb } from '../db';
import { env } from '../env';
import { fetchSite } from './fetchSite';
import { runStaticChecks, liveAgentCheck, type CheckResult, type LiveOutcome } from './checks';
import { score } from './score';
import { writeFindings } from './analyze';

export interface ScanRow {
  id: string;
  url: string;
  merchant_id: string | null;
  status: 'running' | 'done' | 'failed';
  checks: CheckResult[];
  score: number;
  findings: string[];
  created_at: number;
}

function merchantFor(url: string): string | null {
  const demo = `${env.publicBaseUrl}/store/ridgeline`;
  return url.replace(/\/$/, '').startsWith(demo) ? 'ridgeline' : null;
}

export function createScan(url: string): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(`insert into scans (id, url, merchant_id, status, created_at) values (?, ?, ?, 'running', ?)`)
    .run(id, url, merchantFor(url), Date.now());
  return id;
}

export async function completeScan(id: string, url: string): Promise<void> {
  const db = getDb();
  try {
    const snap = await fetchSite(url, { allowHosts: [new URL(env.publicBaseUrl).host] });
    const checks = [...runStaticChecks(snap), liveAgentCheck('not_run', '')];
    const findings = await writeFindings(url, checks);
    db.prepare(`update scans set status = 'done', checks = ?, score = ?, findings = ? where id = ?`).run(
      JSON.stringify(checks), score(checks), JSON.stringify(findings), id,
    );
  } catch (e) {
    db.prepare(`update scans set status = 'failed', findings = ? where id = ?`).run(JSON.stringify([`Scan failed: ${(e as Error).message}`]), id);
  }
}

/** Runs a full scan and waits for it. */
export async function runScan(url: string): Promise<string> {
  const id = createScan(url);
  await completeScan(id, url);
  return id;
}

/** Starts a scan in the background and returns its id immediately (for the API). */
export function startScan(url: string): string {
  const id = createScan(url);
  void completeScan(id, url);
  return id;
}

export function getScan(id: string): ScanRow | null {
  const r = getDb().prepare('select * from scans where id = ?').get(id) as any;
  if (!r) return null;
  return { ...r, checks: JSON.parse(r.checks), findings: JSON.parse(r.findings) };
}

export function updateLiveAgentResult(scanId: string, outcome: LiveOutcome, evidence: string): void {
  const s = getScan(scanId);
  if (!s) return;
  const checks = [...s.checks.filter((c) => c.id !== 'live_agent'), liveAgentCheck(outcome, evidence)];
  getDb().prepare('update scans set checks = ?, score = ? where id = ?').run(JSON.stringify(checks), score(checks), scanId);
}

export function latestScans(merchantId: string, limit = 10): ScanRow[] {
  return (getDb().prepare(`select id from scans where merchant_id = ? and status = 'done' order by created_at desc limit ?`).all(merchantId, limit) as { id: string }[])
    .map((r) => getScan(r.id)!)
    .filter(Boolean);
}
