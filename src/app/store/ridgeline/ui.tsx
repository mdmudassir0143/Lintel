import type { Product } from '@/lib/catalog';

/** Ridgeline's own brand (a merchant, not Lintel): pine, oat and kraft. */
export const R = {
  pine: '#1f3a2e',
  pineSoft: '#2c4d3e',
  oat: '#f7f3ec',
  paper: '#fffdf9',
  kraft: '#c9a27a',
  ink: '#1c1b18',
  muted: '#6b665d',
  line: '#e6dfd2',
};

const LABELS = ['#1f3a2e', '#8c4a2f', '#3e5c7a', '#6b5b2e', '#2f2f2f', '#5a3e5c'];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Roast level 1-3 from structured attributes, or from the shorthand in a raw description. */
export function roastLevel(p: Product): 0 | 1 | 2 | 3 {
  const text = `${p.attributes?.roast ?? ''} ${p.description} ${p.title}`.toLowerCase();
  if (/\b(dark|dk|espresso|espr)\b/.test(text)) return 3;
  if (/\b(medium|med|med-dk)\b/.test(text)) return 2;
  if (/\b(light|lt)\b/.test(text)) return 1;
  return 0;
}

/** A short label for the bag: the part before the dash, without size. */
export function shortName(p: Product) {
  const name = p.title.split(/\s[—–-]\s|,/)[0].replace(/\b\d+\s?(oz|lb|g)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (name.length <= 28) return name;
  return name.slice(0, 28).replace(/\s+\S*$/, ''); // never cut a word in half
}

/** Illustrated product shot: a kraft coffee bag with a printed label (or a pour-over set). */
export function ProductArt({ p, size = 'md' }: { p: Product; size?: 'sm' | 'md' | 'lg' }) {
  const label = LABELS[hash(p.sku) % LABELS.length];
  const roast = roastLevel(p);
  const h = size === 'lg' ? 'h-[420px]' : size === 'sm' ? 'h-24' : 'h-56';
  const isKit = /kit|pour|dripper/i.test(`${p.sku} ${p.title}`);
  return (
    <div className={`relative flex ${h} items-end justify-center overflow-hidden rounded-xl`} style={{ background: '#efe8dc' }} aria-hidden>
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: '#e6dccb' }} />
      {isKit ? (
        <svg viewBox="0 0 200 200" className="relative mb-[6%] h-[78%]">
          <ellipse cx="100" cy="186" rx="70" ry="8" fill="#000" opacity=".08" />
          <path d="M60 150h80l-6 34H66z" fill="#f4f1ea" stroke="#d6cdbd" />
          <path d="M45 62h110l-30 70H75z" fill="#fbfaf7" stroke="#d6cdbd" />
          <path d="M60 70h80l-22 52H82z" fill="#efe9de" />
          <rect x="70" y="132" width="60" height="18" rx="4" fill="#f4f1ea" stroke="#d6cdbd" />
          <path d="M150 80c22 0 22 30 0 30" fill="none" stroke="#d6cdbd" strokeWidth="6" />
        </svg>
      ) : (
        <svg viewBox="0 0 200 220" className="relative mb-[4%] h-[86%]">
          <ellipse cx="100" cy="210" rx="62" ry="7" fill="#000" opacity=".1" />
          <path d="M48 40 L152 40 L160 205 L40 205 Z" fill={R.kraft} />
          <path d="M48 40 L152 40 L150 56 L50 56 Z" fill="#b48c63" />
          <path d="M40 205 L48 40" stroke="#b48c63" strokeWidth="2" />
          <path d="M160 205 L152 40" stroke="#a37d55" strokeWidth="2" />
          <rect x="62" y="82" width="76" height="92" rx="4" fill={R.paper} />
          <rect x="62" y="82" width="76" height="20" rx="4" fill={label} />
          <text x="100" y="96" textAnchor="middle" fontSize="8.5" fill="#fff" fontFamily="Georgia, serif" letterSpacing="1">RIDGELINE</text>
          <foreignObject x="66" y="106" width="68" height="40">
            <div style={{ font: '600 9px/1.15 Georgia, serif', color: R.ink, textAlign: 'center' }}>{shortName(p)}</div>
          </foreignObject>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={88 + i * 12} cy="160" r="4" fill={i < roast ? label : 'none'} stroke={label} strokeWidth="1.5" />
          ))}
          <rect x="88" y="26" width="24" height="16" rx="3" fill="#8f6c49" />
        </svg>
      )}
    </div>
  );
}

export function RoastMeter({ p }: { p: Product }) {
  const roast = roastLevel(p);
  if (!roast) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: R.muted }}>
      {[1, 2, 3].map((i) => <span key={i} className="h-1.5 w-4 rounded-full" style={{ background: i <= roast ? R.pine : R.line }} />)}
      {['', 'Light', 'Medium', 'Dark'][roast]} roast
    </span>
  );
}

export function Mark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill={R.pine} />
      <path d="M5 22 L12 13 L16 18 L20 11 L27 22 Z" fill={R.oat} />
    </svg>
  );
}
