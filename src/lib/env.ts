export interface Env {
  paypalClientId: string;
  paypalClientSecret: string;
  googleApiKey: string;
  geminiModels: string[];
  kernelApiKey?: string;
  browserProvider: 'local' | 'kernel';
  publicBaseUrl: string;
  approvalTimeoutMs: number;
  dbPath: string;
  buyerEmail?: string;
}

type Source = Record<string, string | undefined>;

export function loadEnv(src: Source = process.env): Env {
  const list = (v?: string) =>
    (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const models = list(src.GEMINI_MODELS);
  return {
    paypalClientId: src.PAYPAL_CLIENT_ID ?? '',
    paypalClientSecret: src.PAYPAL_CLIENT_SECRET ?? '',
    googleApiKey: src.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
    geminiModels: models.length ? models : ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash'],
    kernelApiKey: src.KERNEL_API_KEY || undefined,
    browserProvider: src.BROWSER_PROVIDER === 'kernel' ? 'kernel' : 'local',
    publicBaseUrl: (src.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    approvalTimeoutMs: Number(src.APPROVAL_TIMEOUT_MS) || 300000,
    dbPath: src.DB_PATH || './lintel.db',
    buyerEmail: src.PAYPAL_SANDBOX_BUYER_EMAIL || undefined,
  };
}

/** Process env, read lazily so tests and scripts can set variables first. */
export const env: Env = new Proxy({} as Env, {
  get: (_t, key: keyof Env) => loadEnv()[key],
});
