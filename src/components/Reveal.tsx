import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { MOTION_TOKENS } from "@/lib/motion";

function useRevealState(shouldReduceMotion: boolean | null, viewportMargin: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ observing: false, hasEntered: false });

  useEffect(() => {
    const element = ref.current;
    if (shouldReduceMotion || !element || typeof IntersectionObserver === "undefined") return;

    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setState({ observing: false, hasEntered: true });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState({ observing: false, hasEntered: true });
          observer.disconnect();
        }
      },
      { rootMargin: viewportMargin },
    );
    setState({ observing: true, hasEntered: false });
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldReduceMotion, viewportMargin]);

  return {
    ref,
    isHidden: state.observing && !state.hasEntered && !shouldReduceMotion,
  };
}

interface RevealProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  delay?: number;
  distance?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  duration?: number;
  className?: string;
  viewportMargin?: string;
}

/**
 * Scroll reveal driven by a CSS transition on opacity/transform (compositor-only). It used to run a
 * framer-motion animation per element, which put JavaScript animation work into the very frame of the
 * user's first scroll or keypress and hurt INP. Server HTML and no-JS stay fully visible.
 */
export function Reveal({
  children,
  delay = 0,
  distance = MOTION_TOKENS.distance.standard,
  direction = "up",
  duration = MOTION_TOKENS.duration.section,
  className = "",
  viewportMargin = "-60px",
  style,
  ...props
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const { ref, isHidden } = useRevealState(shouldReduceMotion, viewportMargin);
  const [x1, y1, x2, y2] = MOTION_TOKENS.ease.entrance;
  const ease = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  const [dx, dy] = {
    up: [0, distance],
    down: [0, -distance],
    left: [distance, 0],
    right: [-distance, 0],
    none: [0, 0],
  }[direction] as [number, number];

  return (
    <div
      ref={ref}
      className={className}
      data-motion-entrance
      style={{
        opacity: isHidden ? 0 : 1,
        transform: isHidden ? `translate3d(${dx}px, ${dy}px, 0)` : "none",
        ...(shouldReduceMotion
          ? {}
          : {
              transition: `opacity ${duration}s ${ease} ${delay}s, transform ${duration}s ${ease} ${delay}s`,
            }),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
