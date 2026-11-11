'use client';
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Fades and lifts its children into view once, when scrolled to. */
export function Reveal({ children, className = '', y = 40, scale = 0.98 }: { children: ReactNode; className?: string; y?: number; scale?: number }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(root.current, { y, scale, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: root.current, start: 'top 85%', once: true } });
      });
    },
    { scope: root },
  );
  return <div ref={root} className={className}>{children}</div>;
}
