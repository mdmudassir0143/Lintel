import type { Product } from '@/lib/catalog';

export type RunStatus = 'running' | 'awaiting_approval' | 'succeeded' | 'failed';
export type RunListItem = { id: string; scan_id: string | null; kind: 'browser' | 'headless'; goal: string; status: RunStatus; summary: string | null; created_at: number };
export type StoreSummary = {
  merchant: { id: string; name: string; storeUrl: string; installed: boolean; raw: Product[] };
  orders: { id: string; paypal_order_id: string; capture_id: string; amount: string; items: { sku: string; qty: number }[]; payer_email: string | null; run_id: string | null; created_at: number }[];
  scans: { id: string; score: number; created_at: number }[];
  runs: RunListItem[];
};

export const RUN_STATUS: Record<RunStatus, { label: string; tone: 'live' | 'wait' | 'pass' | 'fail' }> = {
  running: { label: 'Shopping', tone: 'live' },
  awaiting_approval: { label: 'Needs your approval', tone: 'wait' },
  succeeded: { label: 'Bought', tone: 'pass' },
  failed: { label: 'Couldn’t buy', tone: 'fail' },
};
