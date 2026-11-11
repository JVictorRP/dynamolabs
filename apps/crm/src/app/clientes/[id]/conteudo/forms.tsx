"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CtaButton, GhostButton } from "@/components/ui";
import type { PreviewPost, PreviewProfile } from "@/components/content/preview-model";
import { STATUS_LABEL } from "@/components/content/preview-model";
import {
  archivePostAction,
  createPostAction,
  deletePostAction,
  markHandledAction,
  regenerateLinkAction,
  removeMediaAction,
  reopenPostAction,
  reorderMediaAction,
  saveProfileAction,
  setStatusAction,
  unarchivePostAction,
  updatePostAction,
} from "./actions";
import { useRun } from "./run";
import { FileUploadButton } from "./uploader";

const field = "mt-2 w-full rounded-[8px] border border-graphite bg-panel px-4 py-3 text-base text-white outline-none transition focus:border-teal";
const Err = ({ text }: { text: string | null }) => (text ? <p className="text-sm font-medium text-amber" role="alert">{text}</p> : null);

/* ───── Link ───── */

export function LinkCard({ orgId, url, message }: { orgId: string; url: string; message: string }) {
  const { run, pending, error } = useRun();
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);
  const copy = async (text: string, what: "link" | "msg") => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
  };
  return (
    <div className="space-y-4">
      <p className="break-all rounded-[8px] border border-graphite bg-panel-2 px-4 py-3 font-mono text-sm text-mist">{url}</p>
      <div className="flex flex-wrap gap-3">
        <CtaButton type="button" onClick={() => copy(message, "msg")}>{copied === "msg" ? "Mensagem copiada" : "Copiar mensagem"}</CtaButton>
        <GhostButton type="button" onClick={() => copy(url, "link")}>{copied === "link" ? "Link copiado" : "Copiar link"}</GhostButton>
        <a href={url} target="_blank" rel="noopener noreferrer" className="label rounded-[12px] border border-graphite px-6 py-3.5 text-[0.7rem] text-mist transition hover:border-gray-300">Abrir como o cliente</a>
        <GhostButton
          type="button"
          disabled={pending}
          onClick={() => confirm("Gerar um link novo? O link atual para de funcionar na hora e o cliente precisa receber o novo.") && run(() => regenerateLinkAction(orgId))}
        >
          Gerar link novo
        </GhostButton>
      </div>
      <Err text={error} />
    </div>
  );
}

/* ───── Fila ───── */

export function HandledButton({ orgId, eventId }: { orgId: string; eventId: string }) {
  const { run, pending, error } = useRun();
  return (
    <span>
      <button type="button" disabled={pending} onClick={() => run(() => markHandledAction(orgId, eventId))} className="footer-line hover:!text-teal">
        {pending ? "Salvando…" : "Marcar como tratado"}
      </button>
      <Err text={error} />
    </span>
  );
}

/* ───── Perfil ───── */

export function ProfileForm({ orgId, profile }: { orgId: string; profile: PreviewProfile }) {
  const { run, pending, error } = useRun();
  const [v, setV] = useState({ handle: profile.handle, displayName: profile.displayName, bio: profile.bio, link: profile.link });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => (setSaved(false), setV({ ...v, [k]: e.target.value }));
  return (
    <div className="space-y-5">
      <form
        className="grid gap-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveProfileAction(orgId, v), () => setSaved(true));
        }}
      >
        <label className="block">
          <span className="footer-line">Usuário no Instagram</span>
          <input value={v.handle} onChange={set("handle")} placeholder="@lojadoze" className={field} maxLength={31} autoComplete="off" />
        </label>
        <label className="block">
          <span className="footer-line">Nome do perfil</span>
          <input value={v.displayName} onChange={set("displayName")} className={field} maxLength={80} />
        </label>
        <label className="block md:col-span-2">
          <span className="footer-line">Bio ({v.bio.length}/150)</span>
          <textarea value={v.bio} onChange={set("bio")} rows={3} className={field} maxLength={150} />
        </label>
        <label className="block md:col-span-2">
          <span className="footer-line">Link do perfil</span>
          <input value={v.link} onChange={set("link")} placeholder="https://…" className={field} maxLength={200} />
        </label>
        <div className="flex items-center gap-4 md:col-span-2">
          <CtaButton type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar perfil"}</CtaButton>
          {saved && <span className="text-sm text-teal" role="status">Salvo.</span>}
        </div>
      </form>
      <div className="space-y-2">
        <p className="footer-line">Foto do perfil {profile.avatarKey ? "(enviada)" : "(ainda sem foto)"}</p>
        <FileUploadButton label={profile.avatarKey ? "Trocar foto" : "Enviar foto"} query={`avatar=1&orgId=${orgId}`} accept="image/jpeg,image/png,image/webp" />
      </div>
      <Err text={error} />
    </div>
  );
}

/* ───── Novo post ───── */

export function NewPostForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { run, pending, error } = useRun();
  const [v, setV] = useState({ format: "feed" as "feed" | "carrossel" | "reels", title: "", caption: "", scheduledAt: "" });
  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createPostAction(orgId, v), (r) => router.push(`?editar=${r.postId}#editor`));
      }}
    >
      <label className="block">
        <span className="footer-line">Formato</span>
        <select value={v.format} onChange={(e) => setV({ ...v, format: e.target.value as typeof v.format })} className={field}>
          <option value="feed">Post único</option>
          <option value="carrossel">Carrossel</option>
          <option value="reels">Reels</option>
        </select>
      </label>
      <label className="block">
        <span className="footer-line">Publicação (opcional)</span>
        <input type="datetime-local" value={v.scheduledAt} onChange={(e) => setV({ ...v, scheduledAt: e.target.value })} className={field} />
      </label>
      <label className="block sm:col-span-2">
        <span className="footer-line">Título interno</span>
        <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex.: Promoção de novembro" className={field} maxLength={120} />
      </label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <CtaButton type="submit" disabled={pending}>{pending ? "Criando…" : "Criar post"}</CtaButton>
        <Err text={error} />
      </div>
    </form>
  );
}

/* ───── Editor do post ───── */

export type EditorPost = PreviewPost & { scheduledLocal: string; archived: boolean };

export function PostEditor({ orgId, post }: { orgId: string; post: EditorPost }) {
  const router = useRouter();
  const { run, pending, error } = useRun();
  const [v, setV] = useState({ title: post.title ?? "", caption: post.caption ?? "", scheduledAt: post.scheduledLocal });
  const [saved, setSaved] = useState(false);
  const approved = post.status === "aprovado" || post.status === "agendado" || post.status === "publicado";
  const images = post.media.filter((m) => !m.isCover);
  const move = (i: number, d: number) => {
    const ids = post.media.map((m) => m.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderMediaAction(orgId, post.id, ids));
  };
  const hasVideo = post.media.some((m) => m.kind === "video");
  const hasCover = post.media.some((m) => m.isCover);

  return (
    <div id="editor" className="space-y-6 rounded-[12px] border border-teal/50 bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow !text-teal">Editando · {post.format === "reels" ? "Reels" : post.format === "carrossel" ? "Carrossel" : "Post único"} · {STATUS_LABEL[post.status]}</p>
        <button type="button" onClick={() => router.push("?")} className="footer-line hover:!text-white">Fechar editor</button>
      </div>
      {approved && (
        <p className="rounded-[8px] border border-amber/50 p-3 text-sm text-amber">
          Este post já foi aprovado. Editar não pede uma nova aprovação: se a mudança for importante, use <strong>Reabrir para aprovação</strong>.
        </p>
      )}
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updatePostAction(orgId, post.id, v), () => setSaved(true));
        }}
      >
        <label className="block">
          <span className="footer-line">Título interno</span>
          <input value={v.title} onChange={(e) => (setSaved(false), setV({ ...v, title: e.target.value }))} className={field} maxLength={120} />
        </label>
        <label className="block">
          <span className="footer-line">Legenda ({v.caption.length}/2200)</span>
          <textarea value={v.caption} onChange={(e) => (setSaved(false), setV({ ...v, caption: e.target.value }))} rows={6} maxLength={2200} className={field} />
        </label>
        <label className="block md:max-w-xs">
          <span className="footer-line">Data de publicação</span>
          <input type="datetime-local" value={v.scheduledAt} onChange={(e) => (setSaved(false), setV({ ...v, scheduledAt: e.target.value }))} className={field} />
        </label>
        <div className="flex items-center gap-4">
          <CtaButton type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</CtaButton>
          {saved && <span className="text-sm text-teal" role="status">Salvo.</span>}
        </div>
      </form>

      <div className="space-y-4">
        <p className="footer-line">Arquivos</p>
        {post.media.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {post.media.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 rounded-[8px] border border-graphite p-2">
                {m.kind === "video" ? (
                  <video src={`/api/conteudo/arquivos/${m.fileKey}`} muted preload="metadata" className="h-16 w-12 rounded object-cover" aria-hidden="true" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/conteudo/arquivos/${m.fileKey}`} alt="" className="h-16 w-12 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1 text-xs text-gray-300">
                  <p className="font-semibold text-mist">{m.isCover ? "Capa" : m.kind === "video" ? "Vídeo" : post.format === "carrossel" ? `Imagem ${images.findIndex((x) => x.id === m.id) + 1}` : "Imagem"}</p>
                  <p className="truncate">{m.fileKey.slice(0, 8)}…</p>
                </div>
                {post.format === "carrossel" && (
                  <span className="flex gap-1">
                    <button type="button" aria-label="Mover para antes" disabled={pending || i === 0} onClick={() => move(i, -1)} className="rounded border border-graphite px-2 py-1 text-xs disabled:opacity-30">↑</button>
                    <button type="button" aria-label="Mover para depois" disabled={pending || i === post.media.length - 1} onClick={() => move(i, 1)} className="rounded border border-graphite px-2 py-1 text-xs disabled:opacity-30">↓</button>
                  </span>
                )}
                <button type="button" disabled={pending} onClick={() => confirm("Remover este arquivo? Ele é apagado do servidor.") && run(() => removeMediaAction(orgId, m.id))} className="footer-line hover:!text-amber">Remover</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-4">
          {post.format === "reels" ? (
            <>
              {!hasVideo && <FileUploadButton label="Enviar vídeo (MP4)" query={`orgId=${orgId}&postId=${post.id}`} accept="video/mp4" />}
              {!hasCover && <FileUploadButton label="Enviar capa" query={`orgId=${orgId}&postId=${post.id}&cover=1`} accept="image/jpeg,image/png,image/webp" />}
            </>
          ) : post.format === "carrossel" ? (
            images.length < 10 && <FileUploadButton label="Enviar imagens" query={`orgId=${orgId}&postId=${post.id}`} multiple accept="image/jpeg,image/png,image/webp" />
          ) : (
            post.media.length === 0 && <FileUploadButton label="Enviar imagem" query={`orgId=${orgId}&postId=${post.id}`} accept="image/jpeg,image/png,image/webp" />
          )}
        </div>
        <p className="text-xs text-gray-500">Imagens JPG, PNG ou WebP até 10 MB. Vídeo MP4 (H.264) até 200 MB, já no formato do Instagram.</p>
      </div>

      <div className="space-y-3 border-t border-graphite pt-5">
        <p className="footer-line">Ações</p>
        <div className="flex flex-wrap gap-3">
          {!approved && <CtaButton type="button" disabled={pending} onClick={() => run(() => setStatusAction(orgId, post.id, "em_aprovacao"))}>{post.status === "em_aprovacao" ? "Reenviar para aprovação" : "Enviar para aprovação"}</CtaButton>}
          {approved && <GhostButton type="button" disabled={pending} onClick={() => run(() => reopenPostAction(orgId, post.id))}>Reabrir para aprovação</GhostButton>}
          {post.status === "aprovado" && <GhostButton type="button" disabled={pending} onClick={() => run(() => setStatusAction(orgId, post.id, "agendado"))}>Marcar agendado</GhostButton>}
          {(post.status === "aprovado" || post.status === "agendado") && <GhostButton type="button" disabled={pending} onClick={() => run(() => setStatusAction(orgId, post.id, "publicado"))}>Marcar publicado</GhostButton>}
          {post.archived ? (
            <GhostButton type="button" disabled={pending} onClick={() => run(() => unarchivePostAction(orgId, post.id))}>Desarquivar</GhostButton>
          ) : (
            <GhostButton type="button" disabled={pending} onClick={() => run(() => archivePostAction(orgId, post.id))}>Arquivar</GhostButton>
          )}
          <GhostButton
            type="button"
            disabled={pending}
            onClick={() => confirm("Apagar este post de vez, com as imagens e os vídeos? Não tem volta.") && run(() => deletePostAction(orgId, post.id), () => router.push("?"))}
          >
            Apagar de vez
          </GhostButton>
        </div>
        <Err text={error} />
      </div>
    </div>
  );
}

export function RestoreButton({ orgId, postId }: { orgId: string; postId: string }) {
  const { run, pending } = useRun();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => unarchivePostAction(orgId, postId))} className="footer-line hover:!text-teal">
      Desarquivar
    </button>
  );
}
