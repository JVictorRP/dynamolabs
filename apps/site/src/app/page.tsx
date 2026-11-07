import { ChatSection } from "@/components/ChatSection";
import { Footer } from "@/components/Footer";
import { HeroStage } from "@/components/HeroStage";
import { SiteHeader } from "@/components/SiteHeader";
import { StageAnchors } from "@/components/StageAnchors";
import { ChatStatic, HeroStatic, Section2Static, Video2Static } from "@/components/StaticSections";
import { Video2Stage } from "@/components/Video2Stage";

export default function Home() {
  return (
    <>
      <a
        href="#top"
        className="absolute top-3 left-3 z-[60] -translate-y-24 rounded-lg bg-teal px-4 py-3 font-label text-xs font-bold tracking-[0.2em] text-graphite uppercase focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <StageAnchors />
      <main id="top">
        <HeroStage />
        <ChatSection />
        <Video2Stage />
        {/* Sem JavaScript: seções estáticas no lugar dos palcos (que o CSS esconde em `scripting: none`). */}
        <noscript>
          <HeroStatic />
          <Section2Static />
          <ChatStatic />
          <Video2Static />
        </noscript>
      </main>
      <Footer />
    </>
  );
}
