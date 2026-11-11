import Link from 'next/link';

/** The Lintel mark: a beam of three stones over two posts — a doorway held open. */
export function Mark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <rect x="1" y="3" width="9" height="5" />
      <rect x="11" y="3" width="5" height="5" />
      <rect x="17" y="3" width="6" height="5" />
      <rect x="3" y="9.5" width="4" height="12" />
      <rect x="17" y="9.5" width="4" height="12" />
    </svg>
  );
}

export function Wordmark({ href = '/', tone = 'dark' }: { href?: string; tone?: 'dark' | 'light' }) {
  return (
    <Link href={href} className={`flex items-center gap-2 ${tone === 'light' ? 'text-white' : 'text-ink'}`} aria-label="Lintel home">
      <Mark className="h-[18px] w-[18px]" />
      <span className="headline text-[19px] leading-none">lintel</span>
    </Link>
  );
}
