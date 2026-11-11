'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Headline whose words rise into place, line by line. */
export function HeroHeadline({ lines, className = '' }: { lines: string[]; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(root.current!.querySelectorAll('[data-w]'), { yPercent: 110, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
        gsap.from(root.current!.parentElement!.querySelectorAll('[data-fade]'), { y: 14, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.55 });
      });
    },
    { scope: root },
  );
  return (
    <h1 ref={root} className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(' ').map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span data-w className="inline-block">{w}{' '}</span>
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
