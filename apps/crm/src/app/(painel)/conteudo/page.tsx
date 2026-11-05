import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { listGrid } from "@/lib/data/content";
import { fmtDate } from "@/lib/format";
import { CtaButton, EmptyState, GhostButton, PageHeader } from "@/components/ui";
import { reviewPostAction } from "./actions";

export const metadata: Metadata = { title: "Conteúdo" };

const STATUS: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "Rascunho", tone: "bg-graphite text-mist" },
  em_aprovacao: { label: "Aprovar", tone: "bg-amber text-graphite" },
  aprovado: { label: "Aprovado", tone: "bg-white text-graphite" },
  agendado: { label: "Agendado", tone: "bg-teal text-graphite" },
  publicado: { label: "Publicado", tone: "bg-void/80 text-gray-300" },
};

export default async function ConteudoPage() {
  const { organization } = await getOrgContext();
  const posts = await listGrid(organization.id);

  return (
    <>
      <PageHeader eyebrow="Conteúdo" title="Sua grade" highlight="grade" support="Toque no post para ver a legenda e aprovar." />
      {posts.length === 0 ? (
        <EmptyState title="Nenhum conteúdo programado" text="Quando a Dynamo montar o próximo calendário, a prévia da grade aparece aqui para sua aprovação." />
      ) : (
        <div className="mx-auto max-w-xl">
          {/* Grade 3 colunas no formato 4:5, igual ao perfil do Instagram */}
          <ul className="grid grid-cols-3 gap-0.5">
            {posts.map((post) => {
              const s = STATUS[post.status];
              return (
                <li key={post.id}>
                  <details className="group">
                    <summary className="relative block aspect-[4/5] cursor-pointer list-none overflow-hidden bg-panel-2">
                      {post.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.coverUrl} alt={post.title ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        <span className="display grid h-full place-items-center p-2 text-center !text-[13px] !text-gray-500">
                          {post.title ?? "Sem capa"}
                        </span>
                      )}
                      <span className={`absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${s.tone}`}>{s.label}</span>
                      {post.format !== "feed" && (
                        <span className="absolute bottom-1 right-1 rounded-[4px] bg-void/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-mist">
                          {post.format}
                        </span>
                      )}
                    </summary>
                    <div className="fixed inset-x-4 bottom-4 z-10 mx-auto max-w-md rounded-[12px] border border-graphite bg-panel p-5 shadow-2xl md:inset-x-auto md:right-8">
                      <p className="eyebrow">{fmtDate(post.scheduledAt)}</p>
                      <p className="display mt-3 text-2xl">{post.title}</p>
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-sm text-mist">{post.caption}</p>
                      {post.status === "em_aprovacao" && (
                        <form action={reviewPostAction} className="mt-4 space-y-2">
                          <input type="hidden" name="postId" value={post.id} />
                          <textarea
                            name="feedback"
                            placeholder="Algum ajuste? (opcional)"
                            className="w-full rounded-[8px] border border-graphite bg-panel-2 p-3 text-sm text-white outline-none focus:border-teal"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <CtaButton name="decision" value="aprovar" className="flex-1 !px-3">
                              Aprovar
                            </CtaButton>
                            <GhostButton name="decision" value="ajustar" className="flex-1 !px-3">
                              Ajustar
                            </GhostButton>
                          </div>
                        </form>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
