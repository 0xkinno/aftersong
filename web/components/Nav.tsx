"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Product" },
  { href: "/method", label: "Method" },
  { href: "/evidence", label: "Evidence" },
  { href: "/judge", label: "For judges" },
  { href: "/app", label: "Open app" },
];

export default function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="nav no-print">
      <nav aria-label="Main" className="nav-inner">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}>
            {i.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
