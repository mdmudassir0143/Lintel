'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STORES = [
  { name: 'Ridgeline Coffee', note: 'Prices hidden, account required', ok: false },
  { name: 'Northside Roastery', note: 'Blocked AI agents', ok: false },
  { name: 'Big marketplace', note: '$23.50, guest checkout', ok: true },
];
const ANSWER = 'Done. I bought it from the marketplace for $23.50. It arrives Thursday.';

function Sparkle({ className = 'h-4 w-4' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9z" /></svg>;
}

/** A chat-assistant conversation that plays when scrolled into view: the small store loses the sale. */
export function ChatDemo() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top 75%', once: true }, defaults: { ease: 'power3.out' } });
        tl.set(q('[data-thinking]'), { autoAlpha: 1 })
          .set(q('[data-searched]'), { autoAlpha: 0 })
          .from(q('[data-user]'), { y: 16, opacity: 0, duration: 0.5 })
          .from(q('[data-thinking]'), { autoAlpha: 0, duration: 0.3 }, '+=0.2')
          .to(q('[data-thinking]'), { autoAlpha: 0, duration: 0.25 }, '+=1.1')
          .to(q('[data-searched]'), { autoAlpha: 1, duration: 0.3 })
          .from(q('[data-card]'), { opacity: 0, y: 14, scale: 0.96, duration: 0.5, stagger: 0.18 }, '+=0.1')
          .from(q('[data-verdict]'), { scale: 0, duration: 0.35, ease: 'back.out(2.5)', stagger: 0.18 }, '<0.25')
          .from(q('[data-word]'), { opacity: 0, duration: 0.05, stagger: 0.045 }, '+=0.2')
          .from(q('[data-lost]'), { opacity: 0, y: 8, duration: 0.5 }, '+=0.3');
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-window)]">
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink/85">Assistant <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg></span>
        <span className="h-7 w-7 rounded-full bg-subtle-strong" aria-hidden />
      </div>
      <div className="space-y-5 px-5 pb-4 pt-2 sm:px-7">
        <div data-user className="ml-auto w-fit max-w-[85%] rounded-3xl bg-[#f2f3f5] px-4 py-2.5 text-[15px] text-ink">
          Buy me a 12 oz bag of Ethiopian coffee under $25.
        </div>
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-ink"><Sparkle className="h-3.5 w-3.5" /></span>
          <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink">
            <div className="grid">
              <p data-thinking className="shimmer invisible w-fit font-medium [grid-area:1/1]">Shopping three stores…</p>
              <p data-searched className="flex w-fit items-center gap-1.5 text-[13.5px] text-muted [grid-area:1/1]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                Visited 3 stores
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {STORES.map((s) => (
                <div key={s.name} data-card className={`rounded-2xl border p-3 ${s.ok ? 'border-success/25 bg-success-wash/60' : 'border-line bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold leading-tight">{s.name}</span>
                    <span data-verdict className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${s.ok ? 'bg-success' : 'bg-danger'}`}>{s.ok ? '✓' : '×'}</span>
                  </div>
                  <p className={`mt-1 text-[12.5px] leading-snug ${s.ok ? 'text-success-ink' : 'text-muted'}`}>{s.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-3">{ANSWER.split(' ').map((w, i) => <span key={i} data-word>{w} </span>)}</p>
          </div>
        </div>
        <p data-lost className="rounded-xl bg-danger-wash/70 px-3.5 py-2.5 text-[13px] text-danger">
          Ridgeline never sees this visit. No cart, no error, no sale.
        </p>
      </div>
      <div className="px-4 pb-4 sm:px-6">
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-white px-4 py-2.5 shadow-[0_2px_10px_-4px_rgb(0_19_36/.12)]">
          <span className="text-xl leading-none text-muted" aria-hidden>+</span>
          <span className="flex-1 text-[15px] text-muted">Ask anything</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
        </div>
      </div>
    </div>
  );
}
