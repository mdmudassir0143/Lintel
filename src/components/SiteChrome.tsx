import Link from 'next/link';
import { Wordmark, Mark } from './brand';
import { ButtonLink } from './ui';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-[15px] text-soft md:flex">
          <Link href="/#product" className="hover:text-ink">Product</Link>
          <Link href="/#payments" className="hover:text-ink">Payments</Link>
          <Link href="/#agents" className="hover:text-ink">For agents</Link>
          <Link href="/docs" className="hover:text-ink">Docs</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">Log in</ButtonLink>
          <ButtonLink href="/signup" variant="primary" size="sm">Get started</ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Keeps the door open for AI shoppers, and settles what they buy through PayPal.</p>
        </div>
        <FooterCol title="Product" links={[['How it works', '/#how'], ['Payments', '/#payments'], ['The nine checks', '/#checks'], ['Log in', '/login'], ['Create an account', '/signup']]} />
        <FooterCol title="Developers" links={[['Docs', '/docs'], ['x402 scheme', '/docs#scheme'], ['lintel.js tools', '/docs#tools'], ['Agent SDK', '/docs#sdk'], ['Postman collection', '/docs#postman'], ['Brand and design system', '/brand']]} />
        <FooterCol title="Try it" links={[['Demo store', '/store/ridgeline'], ['Get started', '/signup']]} />
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-5 py-5 text-[13px] text-muted md:px-8">
        <span className="flex items-center gap-2"><Mark className="h-3.5 w-3.5" /> Lintel, 2026</span>
        <span>Hosted on Render. Agent browsers by Kernel. Payments run in PayPal sandbox during the preview.</span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {links.map(([l, h]) => <li key={h}><Link href={h} className="hover:text-ink">{l}</Link></li>)}
      </ul>
    </div>
  );
}
