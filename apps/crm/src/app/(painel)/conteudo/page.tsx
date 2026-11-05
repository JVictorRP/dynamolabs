import type { Metadata } from "next";
import { getOrgContext } from "@/lib/context";
import { listGrid } from "@/lib/data/content";
import { fmtDate } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { reviewPostAction } from "./actions";

export const metadata: Metadata = { title: "Conteúdo" };

const STATUS: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "Rascunho", tone: "bg-ink-700 text-ink-300" },
  em_aprovacao: { label: "Aguardando você", tone: "bg-dyn-orange text-ink-950" },
  aprovado: { label: "Aprovado", tone: "bg-ink-100 text-ink-950" },
  agendado: { label: "Agendado", tone: "bg-dyn-blue text-white" },
  publicado: { label: "Publicado", tone: "bg-ink-800 text-ink-400" },
};

export default async function ConteudoPage() {
  const { organization } = await getOrgContext();
  const posts = await listGrid(organization.id);

  return (
    <>
      <PageHeader eyebrow="Conteúdo" title="Prévia da grade do Instagram" />
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
                    <summary className="relative block aspect-[4/5] cursor-pointer list-none overflow-hidden bg-ink-850">
                      {post.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.coverUrl} alt={post.title ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full place-items-center p-2 text-center text-[11px] text-ink-500">
                          {post.title ?? "Sem capa"}
                        </span>
                      )}
                      <span className={`absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${s.tone}`}>{s.label}</span>
                      {post.format !== "feed" && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-ink-100">
                          {post.format}
                        </span>
                      )}
                    </summary>
                    <div className="fixed inset-x-4 bottom-4 z-10 mx-auto max-w-md rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-2xl md:inset-x-auto md:right-8">
                      <p className="eyebrow">{fmtDate(post.scheduledAt)}</p>
                      <p className="mt-2 font-medium">{post.title}</p>
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-sm text-ink-300">{post.caption}</p>
                      {post.status === "em_aprovacao" && (
                        <form action={reviewPostAction} className="mt-4 space-y-2">
                          <input type="hidden" name="postId" value={post.id} />
                          <textarea
                            name="feedback"
                            placeholder="Algum ajuste? (opcional)"
                            className="w-full rounded-lg border border-ink-700 bg-ink-850 p-2 text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button name="decision" value="aprovar" className="flex-1 rounded-lg bg-dyn-orange py-2 text-sm font-semibold text-ink-950">
                              Aprovar
                            </button>
                            <button name="decision" value="ajustar" className="flex-1 rounded-lg border border-ink-700 py-2 text-sm">
                              Pedir ajuste
                            </button>
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
