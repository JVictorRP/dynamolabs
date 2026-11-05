"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-dyn-orange-soft text-dyn-orange" : "text-ink-400 hover:bg-ink-850 hover:text-ink-100"
      }`}
    >
      {children}
    </Link>
  );
}
