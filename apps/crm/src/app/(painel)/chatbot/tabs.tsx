"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/chatbot", label: "Visão geral" },
  { href: "/chatbot/conversas", label: "Conversas" },
  { href: "/chatbot/estilo", label: "Estilo" },
  { href: "/chatbot/planilhas", label: "Planilhas" },
  { href: "/chatbot/automacoes", label: "Automações" },
  { href: "/chatbot/simulador", label: "Simulador" },
];

export function ChatbotTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-[8px] border border-graphite bg-panel p-1">
      {TABS.map((t) => {
        const active = t.href === "/chatbot" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`footer-line shrink-0 whitespace-nowrap rounded-[6px] px-3 py-2 ${active ? "bg-graphite !text-white" : "hover:!text-white"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
