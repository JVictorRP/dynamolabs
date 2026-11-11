import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { getProfile } from "@/lib/content/profile";
import { listPostsForClient } from "@/lib/content/posts";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PanelPreview } from "@/components/content/panel-preview";
import { toPreviewPost } from "@/components/content/preview-model";

export const metadata: Metadata = { title: "Conteúdo" };

export default async function ConteudoPage() {
  const { organization } = await getOrgContext();
  const [profile, posts] = await Promise.all([getProfile(db, organization.id), listPostsForClient(db, organization.id, new Date())]);
  return (
    <>
      <PageHeader eyebrow="Conteúdo" title="Sua grade" highlight="grade" support="Toque no post para ver a prévia, aprovar ou pedir ajuste." />
      <PanelPreview profile={profile} posts={posts.map((p) => toPreviewPost(p, { forClient: true }))} />
    </>
  );
}
