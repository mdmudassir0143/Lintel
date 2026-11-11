'use client';
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll motion for the landing page. Markup opts in with data attributes:
 *   data-reveal        rises in when scrolled into view (siblings stagger)
 *   data-beam-fill     its children fill left to right when in view
 *   data-steps         a list whose [data-steps-line] grows with scroll
 *   data-progress      a bar that tracks reading progress
 * Content already on screen at load is left alone; reduced motion disables everything.
 */
export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        const below = (q('[data-reveal]') as HTMLElement[]).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
        gsap.set(below, { opacity: 0, y: 28 });
        ScrollTrigger.batch(below, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.09, overwrite: true }),
        });

        for (const beam of q('[data-beam-fill]') as HTMLElement[]) {
          gsap.from(beam.firstElementChild?.children ?? beam.children, {
            scaleX: 0, transformOrigin: '0% 50%', duration: 0.7, ease: 'power3.out', stagger: 0.08,
            scrollTrigger: { trigger: beam, start: 'top 85%', once: true },
          });
        }

        for (const list of q('[data-steps]') as HTMLElement[]) {
          const line = list.querySelector('[data-steps-line]');
          if (line) gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: { trigger: list, start: 'top 75%', end: 'bottom 60%', scrub: true } });
        }

        const bar = q('[data-progress]')[0];
        if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', ease: 'none', scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });
      });
    },
    { scope: root },
  );
  return (
    <div ref={root}>
      <div data-progress className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-brand" aria-hidden />
      {children}
    </div>
  );
}
