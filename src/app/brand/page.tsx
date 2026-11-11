'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { Mark, PayPalMark } from '@/components/brand';
import { Button, Pill, Panel, PanelHeader, Spinner } from '@/components/ui';
import { Beam, LintelScore, CHECK_ORDER } from '@/components/LintelScore';
import { ROLE_GROUPS, PALETTE } from '@/lib/ui/tokens';
import type { CheckResult } from '@/lib/scan/checks';

const WEIGHTS = [30, 15, 10, 10, 10, 10, 5, 5, 5];
function checks(pass: number): CheckResult[] {
  return CHECK_ORDER.map((id, i) => ({ id, weight: WEIGHTS[i], title: id, why: '', evidence: '', status: i === 0 ? (pass >= 100 ? 'pass' : 'fail') : i <= Math.round(pass / 9) ? 'pass' : i === Math.round(pass / 9) + 1 ? 'partial' : 'fail' })) as CheckResult[];
}

/** Reads CSS custom properties so the swatches always show the live values. */
function useCssVars(names: string[]) {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setVals(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return vals;
}

const roleVars = ROLE_GROUPS.flatMap((g) => g.roles.map((r) => `--color-${r.name}`));
const paletteVars = PALETTE.flatMap((p) => p.steps.map((s) => `--p-${p.name}-${s}`));

export default function BrandPage() {
  const vals = useCssVars([...roleVars, ...paletteVars]);
  const hex = (v: string) => (vals[v] ?? '').toUpperCase();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
        <h1 className="t-display max-w-[800px]">Brand and design system</h1>
        <p className="mt-5 max-w-[620px] text-lg leading-relaxed text-soft">
          Everything Lintel looks like comes from this page. Components use color roles, never raw values, so a change here changes the product everywhere.
        </p>
        <nav className="mt-8 flex flex-wrap gap-2 text-sm">
          {['Logo', 'Color', 'Palette', 'Type', 'Components', 'Rules'].map((s) => (
            <a key={s} href={`#${s.toLowerCase()}`} className="rounded-full border border-line px-3 py-1 text-soft hover:border-ink/40 hover:text-ink">{s}</a>
          ))}
        </nav>

        <Section id="logo" title="Logo" note="A beam over two posts: the doorway Lintel holds open. Use the mark alone only where the name already appears.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid h-40 place-items-center rounded-xl border border-line bg-surface"><Lockup /></div>
            <div className="grid h-40 place-items-center rounded-xl bg-night text-white"><Lockup /></div>
            <div className="grid h-40 place-items-center rounded-xl bg-brand text-white"><Mark className="h-12 w-12" /></div>
          </div>
        </Section>

        <Section id="color" title="Color roles" note="Use these in components, through Tailwind classes: bg-{role}, text-{role}, border-{role}.">
          <div className="space-y-10">
            {ROLE_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                  <h3 className="t-h3">{g.title}</h3>
                  <p className="text-sm text-muted">{g.note}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.roles.map((r) => (
                    <div key={r.name} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3">
                      <div className="h-14 w-14 shrink-0 rounded-lg border border-ink/10" style={{ background: `var(--color-${r.name})` }} />
                      <div className="min-w-0">
                        <p className="font-mono text-[13px] font-semibold">{r.name}</p>
                        <p className="num text-[13px] text-muted">{hex(`--color-${r.name}`) || '…'}</p>
                        <p className="mt-0.5 text-[13px] leading-snug text-soft">{r.usage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="palette" title="Palette" note="The raw values behind the roles. Electric blue and deep navy lead; teal is the only second accent.">
          <div className="space-y-3">
            {PALETTE.map((p) => (
              <div key={p.name} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
                <span className="text-sm font-medium capitalize">{p.name}</span>
                <div className="flex overflow-hidden rounded-xl border border-line">
                  {p.steps.map((s) => (
                    <div key={s} className="min-w-0 flex-1">
                      <div className="h-14" style={{ background: `var(--p-${p.name}-${s})` }} />
                      <div className="bg-surface px-2 py-1.5">
                        <p className="text-[12px] font-semibold">{s}</p>
                        <p className="num truncate text-[11px] text-muted">{hex(`--p-${p.name}-${s}`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="type" title="Type" note="Host Grotesk for everything people read, Geist Mono only for code. Headlines are 600 with tight tracking and scale fluidly with the screen.">
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            <TypeRow cls="t-display" spec="Display, 44 to 72px">Let it in.</TypeRow>
            <TypeRow cls="t-h1" spec="H1, 32 to 44px, section headings">Agents pay over HTTP.</TypeRow>
            <TypeRow cls="t-h2" spec="H2, 26 to 34px, page titles">Readiness report</TypeRow>
            <TypeRow cls="t-h3" spec="H3, 22px">Agent orders</TypeRow>
            <TypeRow cls="t-stat" spec="Stat, 34px, tabular">$22.00</TypeRow>
            <TypeRow cls="text-lg leading-relaxed text-soft" spec="Body large, 18px">Lintel finds what stops AI shopping agents at your store.</TypeRow>
            <TypeRow cls="text-[15px] leading-relaxed" spec="Body, 15 to 16px">Nothing is charged until you approve in PayPal.</TypeRow>
            <TypeRow cls="t-label" spec="Label, 13px muted">Paid by AI agents</TypeRow>
            <TypeRow cls="font-mono text-[13px]" spec="Code, Geist Mono 13px">checkout_with_paypal → 402</TypeRow>
          </div>
        </Section>

        <Section id="components" title="Components" note="Built from the roles above. Radius: 8px for controls, 12px for panels, none for stones.">
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Panel>
              <PanelHeader title="Buttons" sub="One primary action per view." />
              <div className="flex flex-wrap items-center gap-3 p-5">
                <Button>Scan my store</Button>
                <Button variant="dark">Launch app</Button>
                <Button variant="secondary">Scan again</Button>
                <Button variant="ghost">Uninstall Lintel</Button>
                <Button><PayPalMark className="h-4 w-4" /> Approve in PayPal</Button>
                <Button disabled><Spinner /> Installing</Button>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Status pills" sub="Always text plus color, never color alone." />
              <div className="flex flex-wrap gap-2 p-5">
                <Pill tone="pass">Open to agents</Pill>
                <Pill tone="live">Shopping</Pill>
                <Pill tone="wait">Needs your approval</Pill>
                <Pill tone="fail">Couldn’t buy</Pill>
                <Pill tone="neutral">Not scanned</Pill>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Input" />
              <div className="p-5">
                <input placeholder="yourstore.com" className="h-11 w-full rounded-lg border border-line-strong bg-surface px-4 outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10" />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Code" />
              <div className="p-5">
                <pre className="overflow-x-auto rounded-xl bg-night p-4 font-mono text-[12.5px] leading-[1.7] text-white/85">{`HTTP/1.1 402 Payment Required\n{ "scheme": "paypal-order", "amount": "22.00" }`}</pre>
              </div>
            </Panel>
            <Panel className="lg:col-span-2">
              <PanelHeader title="The beam" sub="Nine segments, one per check, each as wide as its points. Blue passes, light blue is partial, grey is missing. The number stays ink; the pill carries the color." />
              <div className="grid gap-8 p-6 md:grid-cols-3">
                {[0, 55, 100].map((s) => (
                  <div key={s}>
                    <LintelScore checks={checks(s)} score={s} />
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6"><Beam checks={checks(100)} className="h-3" animate={false} /></div>
            </Panel>
          </div>
        </Section>

        <Section id="rules" title="Rules" note="What keeps it looking like one product.">
          <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {[
              ['Roles, not hex', 'Write bg-surface or text-muted. A raw hex in a component is a bug.'],
              ['Blue means act', 'Brand blue is for things you can click and for stones that hold. Don’t use it as decoration.'],
              ['Status has a wash and a tone', 'Use the wash for the background and the tone for text and dots. Pair color with words.'],
              ['One bold thing per view', 'A product shot, a score, or a single dark section. Everything around it stays quiet.'],
              ['Flat color, no gradients', 'Every surface is one solid color. Depth comes from a 1px line and soft shadows on product shots only.'],
              ['Plain words', 'Sentence case. Buttons say what happens: Install Lintel, Approve in PayPal.'],
            ].map(([t, d]) => (
              <li key={t}><p className="font-semibold">{t}</p><p className="mt-1 text-[15px] leading-relaxed text-soft">{d}</p></li>
            ))}
          </ul>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}

function Lockup() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark className="h-7 w-7" />
      <span className="headline text-[30px] leading-none">lintel</span>
    </span>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-24 border-t border-line pt-10">
      <h2 className="t-h1">{title}</h2>
      <p className="mt-2 max-w-[640px] text-muted">{note}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function TypeRow({ cls, spec, children }: { cls: string; spec: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 px-5 py-5 md:grid-cols-[13rem_1fr] md:items-baseline">
      <p className="t-label">{spec}</p>
      <p className={`min-w-0 break-words ${cls}`}>{children}</p>
    </div>
  );
}
