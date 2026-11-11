export interface Env {
  paypalClientId: string;
  paypalClientSecret: string;
  googleApiKey: string;
  geminiModels: string[];
  groqApiKey?: string;
  /** provider:model ids in fallback order, e.g. groq:openai/gpt-oss-120b */
  llmModels: string[];
  kernelApiKey?: string;
  browserProvider: 'local' | 'kernel';
  publicBaseUrl: string;
  approvalTimeoutMs: number;
  dbPath: string;
  buyerEmail?: string;
  /** Accounts with these emails get the admin role. */
  adminEmails: string[];
  googleClientId?: string;
  googleClientSecret?: string;
  shopifyApiKey?: string;
  shopifyApiSecret?: string;
  /** Key material for encrypting stored third-party tokens. */
  lintelSecret: string;
}

type Source = Record<string, string | undefined>;

export function loadEnv(src: Source = process.env): Env {
  const list = (v?: string) =>
    (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const models = list(src.GEMINI_MODELS);
  const gemini = models.length ? models : ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
  const groqDefaults = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
  const explicit = list(src.LLM_MODELS);
  const llmModels = explicit.length
    ? explicit
    : [...(src.GROQ_API_KEY ? groqDefaults.map((m) => `groq:${m}`) : []), ...gemini.map((m) => `google:${m}`)];
  return {
    llmModels,
    groqApiKey: src.GROQ_API_KEY || undefined,
    paypalClientId: src.PAYPAL_CLIENT_ID ?? '',
    paypalClientSecret: src.PAYPAL_CLIENT_SECRET ?? '',
    googleApiKey: src.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
    geminiModels: gemini,
    kernelApiKey: src.KERNEL_API_KEY || undefined,
    browserProvider: src.BROWSER_PROVIDER === 'kernel' ? 'kernel' : 'local',
    publicBaseUrl: (src.PUBLIC_BASE_URL || src.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, ''),
    approvalTimeoutMs: Number(src.APPROVAL_TIMEOUT_MS) || 900000,
    dbPath: src.DB_PATH || './lintel.db',
    buyerEmail: src.PAYPAL_SANDBOX_BUYER_EMAIL || undefined,
    adminEmails: list(src.ADMIN_EMAILS).map((e) => e.toLowerCase()),
    googleClientId: src.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: src.GOOGLE_CLIENT_SECRET || undefined,
    shopifyApiKey: src.SHOPIFY_API_KEY || undefined,
    shopifyApiSecret: src.SHOPIFY_API_SECRET || undefined,
    lintelSecret: src.LINTEL_SECRET || `dev-only:${src.PAYPAL_CLIENT_SECRET ?? 'lintel'}`,
  };
}

/** Process env, read lazily so tests and scripts can set variables first. */
export const env: Env = new Proxy({} as Env, {
  get: (_t, key: keyof Env) => loadEnv()[key],
});
