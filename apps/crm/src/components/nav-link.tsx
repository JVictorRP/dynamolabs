"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[8px] px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] transition ${
        active ? "bg-graphite text-white" : "text-gray-300 hover:text-white"
      }`}
    >
      <i className={`size-[7px] rounded-full ${active ? "bg-teal" : "bg-transparent"}`} aria-hidden="true" />
      {children}
    </Link>
  );
}
