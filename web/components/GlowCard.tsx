"use client";
import type { CSSProperties, ElementType, ReactNode, PointerEvent } from "react";

/** A card whose ember glow follows the pointer. Text contrast is unchanged: the glow sits under content. */
export default function GlowCard({ children, className = "", as: Tag = "div", style }: { children: ReactNode; className?: string; as?: ElementType; style?: CSSProperties }) {
  const move = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag className={`card ${className}`} onPointerMove={move} style={style}>
      {children}
    </Tag>
  );
}
