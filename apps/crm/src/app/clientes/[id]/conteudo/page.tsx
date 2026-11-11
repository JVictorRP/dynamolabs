import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/accounts";
import { listPendingActions } from "@/lib/content/decisions";
import { toSaoPauloLocal } from "@/lib/content/dates";
import { getProfile } from "@/lib/content/profile";
import { listPostsForStaff } from "@/lib/content/posts";
import { ensureShare } from "@/lib/content/share";
import { getStorage } from "@/lib/content/storage-instance";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ContentPreview } from "@/components/content/content-preview";
import { STATUS_LABEL, toPreviewPost, type PreviewProfile } from "@/components/content/preview-model";
import { HandledButton, LinkCard, NewPostForm, PostEditor, ProfileForm, RestoreButton } from "./forms";

export const metadata: Metadata = { title: "Conteúdo do cliente" };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
const FORMAT = { feed: "Post único", carrossel: "Carrossel", reels: "Reels", stories: "Stories" } as const;

export default async function ConteudoClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; editar?: string }> }) {
  const { id } = await params;
  const { aba, editar } = await searchParams;
  const client = await getClient(db, id);
  if (!client) notFound();
  const archivedTab = aba === "arquivados";
  const base = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

  const storage = getStorage();
  const [share, profile, active, listed, pending, usedHere, usedTotal] = await Promise.all([
    ensureShare(db, id),
    getProfile(db, id),
    listPostsForStaff(db, id, { archived: false }),
    listPostsForStaff(db, id, { archived: archivedTab }),
    listPendingActions(db, id),
    storage.usage(id).catch(() => 0),
    storage.usage().catch(() => 0),
  ]);
  const url = `${base}/p/${share.token}`;
  const message = `Olá! Seus próximos posts estão prontos para você ver e aprovar: ${url}\nToque em cada post para ver a prévia e aprove ou peça ajuste.`;
  const previewProfile: PreviewProfile = profile;
  const editing = editar ? [...active, ...listed].find((p) => p.id === editar) : undefined;
  const fileBase = "/api/conteudo/arquivos";

  return (
    <>
      <PageHeader eyebrow={client.name} title="Conteúdo" highlight="Conteúdo" support="Monte os posts e mande o link para o cliente aprovar." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-10">
          <Card className="space-y-4">
            <CardTitle>Link do cliente</CardTitle>
            <p className="text-sm text-gray-300">Um link fixo por cliente, sem login. Mostra os posts enviados para aprovação e os aprovados nos últimos 3 dias.</p>
            <LinkCard orgId={id} url={url} message={message} />
          </Card>

          {pending.length > 0 && (
            <Card className="space-y-4 !border-amber/60">
              <CardTitle>Precisa de ação ({pending.length})</CardTitle>
              <ul className="divide-y divide-graphite">
                {pending.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-white">
                        <span className={e.type === "aprovado" ? "text-teal" : "text-amber"}>{e.type === "aprovado" ? "Aprovou" : "Pediu ajuste"}</span> · {e.postTitle ?? "post sem título"}
                      </p>
                      {e.text && <p className="mt-1 whitespace-pre-line text-gray-300">“{e.text}”</p>}
                      <p className="footer-line mt-1">{fmtDate(e.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Link href={`?editar=${e.postId}#editor`} className="footer-line hover:!text-white">Abrir post</Link>
                      <HandledButton orgId={id} eventId={e.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="space-y-4">
            <CardTitle>Perfil do Instagram</CardTitle>
            <ProfileForm orgId={id} profile={previewProfile} />
          </Card>

          <Card className="space-y-5">
            <CardTitle>Novo post</CardTitle>
            <NewPostForm orgId={id} />
          </Card>

          {editing && (
            <PostEditor
              key={editing.id + editing.status + editing.media.map((m) => m.id).join()}
              orgId={id}
              post={{ ...toPreviewPost(editing), scheduledLocal: toSaoPauloLocal(editing.scheduledAt), archived: Boolean(editing.archivedAt) }}
            />
          )}

          <section className="space-y-4" aria-label="Posts">
            <div className="flex items-center justify-between gap-4">
              <p className="eyebrow eyebrow-muted">Posts</p>
              <nav className="flex rounded-[8px] border border-graphite bg-panel p-1">
                <Link href="?" className={`footer-line rounded-[6px] px-3 py-2 ${!archivedTab ? "bg-graphite !text-white" : ""}`}>Ativos ({active.length})</Link>
                <Link href="?aba=arquivados" className={`footer-line rounded-[6px] px-3 py-2 ${archivedTab ? "bg-graphite !text-white" : ""}`}>Arquivados</Link>
              </nav>
            </div>
            {listed.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-graphite px-6 py-10 text-center text-sm text-gray-300">
                {archivedTab ? "Nenhum post arquivado." : "Nenhum post ainda. Crie o primeiro acima."}
              </p>
            ) : (
              <ul className="divide-y divide-graphite rounded-[12px] border border-graphite bg-panel">
                {listed.map((p) => {
                  const thumb = p.media.find((m) => m.isCover) ?? p.media.find((m) => m.kind === "image");
                  return (
                    <li key={p.id} className="flex items-center gap-4 px-4 py-3">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${fileBase}/${thumb.fileKey}`} alt="" className="h-16 w-12 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="grid h-16 w-12 shrink-0 place-items-center rounded bg-panel-2 text-[10px] text-gray-500">sem imagem</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{p.title ?? "Sem título"}</p>
                        <p className="footer-line mt-1">{FORMAT[p.format]} · {STATUS_LABEL[p.status]}{p.scheduledAt ? ` · ${fmtDate(p.scheduledAt)}` : ""}</p>
                      </div>
                      {archivedTab && <RestoreButton orgId={id} postId={p.id} />}
                      <Link href={`?${archivedTab ? "aba=arquivados&" : ""}editar=${p.id}#editor`} className="footer-line hover:!text-teal">Editar</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="footer-line">Espaço usado: {mb(usedHere)} neste cliente · {mb(usedTotal)} no total</p>
          <Link href={`/clientes/${id}`} className="footer-line block hover:!text-white">← Voltar ao cliente</Link>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Prévia como o cliente vê">
          <p className="eyebrow eyebrow-muted mb-4 text-center">Prévia (todos os posts ativos)</p>
          <ContentPreview profile={previewProfile} posts={active.map(toPreviewPost)} fileBase={fileBase} mode="staff" />
        </aside>
      </div>
    </>
  );
}
