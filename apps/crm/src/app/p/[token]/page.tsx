import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/content/profile";
import { pageLimiter } from "@/lib/content/link-instance";
import { listPostsForClient } from "@/lib/content/posts";
import { resolveShare } from "@/lib/content/share";
import { clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { LinkPreview } from "@/components/content/link-preview";
import { toPreviewPost } from "@/components/content/preview-model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prévia dos posts", robots: { index: false, follow: false } };

/** Link fixo de prévia do cliente. Sem login: código desconhecido ou revogado cai na mesma página neutra (not-found). */
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!pageLimiter.hit(clientIp(await headers()))) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="max-w-sm text-gray-300">Muitas tentativas em pouco tempo. Aguarde alguns minutos e abra o link de novo.</p>
      </main>
    );
  }
  const share = await resolveShare(db, token);
  if (!share) notFound();
  const [profile, posts] = await Promise.all([getProfile(db, share.organizationId), listPostsForClient(db, share.organizationId, new Date())]);
  return (
    <main className="min-h-dvh bg-black sm:py-10">
      <LinkPreview token={token} profile={profile} posts={posts.map((p) => toPreviewPost(p, { forClient: true }))} />
    </main>
  );
}
