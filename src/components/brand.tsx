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

/** PayPal's monogram (Simple Icons, CC0). Shown on every "Approve in PayPal" action. */
export function PayPalMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M7.016 19.198h-4.2a.562.562 0 0 1-.555-.65L5.093.584A.692.692 0 0 1 5.776 0h7.222c3.417 0 5.904 2.488 5.846 5.5-.006.25-.027.5-.066.747A6.794 6.794 0 0 1 12.071 12H8.743a.69.69 0 0 0-.682.583l-.325 2.056-.013.083-.692 4.39-.015.087zM19.79 6.142c-.01.087-.01.175-.023.261a7.76 7.76 0 0 1-7.695 6.598H9.007l-.283 1.795-.013.083-.692 4.39-.134.843-.014.088H6.86l-.497 3.15a.562.562 0 0 0 .555.65h3.612c.34 0 .63-.249.683-.585l.952-6.031a.692.692 0 0 1 .683-.584h2.126a6.793 6.793 0 0 0 6.707-5.752c.306-1.95-.466-3.744-1.89-4.906z" />
    </svg>
  );
}
