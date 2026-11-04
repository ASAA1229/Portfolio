import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function Particles({ count = 30 }: { count?: number }) {
  const shouldReduceMotion = useReducedMotion();
  const [dots, setDots] = useState<{ l: number; d: number; s: number; delay: number }[]>([]);
  useEffect(() => {
    if (shouldReduceMotion) {
      setDots([]);
      return;
    }
    setDots(
      Array.from({ length: count }, () => ({
        l: Math.random() * 100,
        d: 12 + Math.random() * 18,
        s: 1 + Math.random() * 2.5,
        delay: -Math.random() * 30,
      })),
    );
  }, [count, shouldReduceMotion]);
  if (shouldReduceMotion) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full bg-accent"
          style={{
            left: `${p.l}%`,
            width: p.s,
            height: p.s,
            boxShadow: "0 0 8px var(--accent)",
            animation: `float-up ${p.d}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
