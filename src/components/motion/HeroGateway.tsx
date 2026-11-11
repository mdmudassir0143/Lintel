'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { PayPalMark } from '../brand';

gsap.registerPlugin(useGSAP);

const WEIGHTS = [30, 15, 10, 10, 10, 10, 5, 5, 5];
// Blue to violet across the beam.
const STONE = ['#2d2df1', '#3530f2', '#3d34f4', '#4638f5', '#4f3df7', '#5a44f9', '#6449fb', '#6e50fd', '#7b61ff'];

const STEPS: { text: string; sub: string; pay?: boolean }[] = [
  { text: 'Found the store’s tools', sub: 'search, cart, checkout' },
  { text: 'Searched “Ethiopian”', sub: 'Yirgacheffe, 12 oz, $22.00' },
  { text: 'Added to cart', sub: 'RC-ETH12 × 1' },
  { text: 'You approved in PayPal', sub: 'Nothing charged before this', pay: true },
];

/** The doorway: posts rise, the lintel sets stone by stone, then an agent walks through and pays. */
export function HeroGateway() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(q('[data-anim]'), { clearProps: 'all', opacity: 1 });
      });
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const build = gsap.timeline({ defaults: { ease: 'power3.out' } });
        build
          .from(q('[data-post]'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, stagger: 0.08 })
          .from(q('[data-stone]'), { y: -70, opacity: 0, rotate: () => gsap.utils.random(-8, 8), duration: 0.7, ease: 'back.out(1.7)', stagger: 0.07 }, '-=0.25')
          .from(q('[data-glow]'), { opacity: 0, duration: 0.8 }, '-=0.3')
          .from(q('[data-room]'), { opacity: 0, y: 12, duration: 0.5 }, '-=0.5');

        const walk = gsap.timeline({ repeat: -1, repeatDelay: 1.2, defaults: { ease: 'power2.out' } });
        walk
          .fromTo(q('[data-agent]'), { x: -150, opacity: 0, scale: 0.9 }, { x: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out' })
          .fromTo(q('[data-step]'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.55 }, '+=0.15')
          .fromTo(q('[data-check]'), { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(2.5)', stagger: 0.55 }, '<0.15')
          .fromTo(q('[data-paid]'), { y: 16, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.8)' }, '+=0.2')
          .to(q('[data-paid-amount]'), { textContent: 22, duration: 0.8, snap: { textContent: 1 }, ease: 'power1.out' }, '<')
          .to({}, { duration: 2.6 })
          .to(q('[data-step], [data-paid], [data-agent]'), { opacity: 0, y: -8, duration: 0.4, stagger: 0.03, ease: 'power1.in' });
        build.add(walk, '-=0.1');
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[560px] select-none" aria-label="An AI agent walks through an open doorway and pays through PayPal">
      {/* Beam */}
      <div className="relative z-10 flex h-12 gap-1 sm:h-14">
        {WEIGHTS.map((w, i) => (
          <div
            key={i}
            data-stone
            data-anim
            className="min-w-0 basis-0 rounded-[5px] shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_8px_18px_-8px_rgb(45_45_241/.55)]"
            style={{ flexGrow: w, background: `linear-gradient(180deg, ${STONE[i]}cc, ${STONE[i]})` }}
          />
        ))}
      </div>
      {/* Posts and the room between them */}
      <div className="relative mt-1 flex gap-1 px-[5%]">
        <div data-post data-anim className="w-[9%] shrink-0 rounded-b-[5px] bg-gradient-to-b from-[#c9c9fb] to-[#eeeefe] ring-1 ring-brand/10" />
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-b-2xl bg-white/80 ring-1 ring-line backdrop-blur">
          <div data-glow data-anim className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgb(45_45_241/.16),transparent_70%),radial-gradient(60%_40%_at_50%_100%,rgb(23_202_198/.14),transparent_70%)]" />
          <div data-room data-anim className="relative flex min-h-[340px] flex-col p-4 sm:min-h-[380px] sm:p-5">
            <div data-agent className="flex items-center gap-2.5 self-start rounded-full bg-white py-1 pl-1 pr-3 shadow-[var(--shadow-card)]">
              <span className="brand-gradient grid h-7 w-7 place-items-center rounded-full text-white">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9z" /></svg>
              </span>
              <span className="text-[13px] font-semibold">AI agent</span>
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />
            </div>
            <ul className="mt-4 space-y-2.5">
              {STEPS.map((s) => (
                <li key={s.text} data-step className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[var(--shadow-card)]">
                  <span data-check className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${s.pay ? 'bg-ink' : 'bg-brand'}`}>
                    {s.pay ? <PayPalMark className="h-3 w-3" /> : <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold leading-tight">{s.text}</span>
                    <span className="block truncate text-[12px] text-muted">{s.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div data-paid className="mt-auto flex items-center justify-between rounded-xl bg-success-wash px-4 py-3 ring-1 ring-success/15">
              <span className="text-[13px] font-semibold text-success-ink">Paid through PayPal</span>
              <span className="t-stat text-[24px] text-success-ink">$<span data-paid-amount>22</span>.00</span>
            </div>
          </div>
        </div>
        <div data-post data-anim className="w-[9%] shrink-0 rounded-b-[5px] bg-gradient-to-b from-[#c9c9fb] to-[#eeeefe] ring-1 ring-brand/10" />
      </div>
      {/* Threshold */}
      <div className="mx-[2%] mt-1 h-1.5 rounded-full bg-line" aria-hidden />
    </div>
  );
}
