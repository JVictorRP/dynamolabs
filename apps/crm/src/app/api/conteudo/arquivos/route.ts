import { attachMedia, setAvatar } from "@/lib/content/media";
import { FileError } from "@/lib/content/files";
import { getStorage } from "@/lib/content/storage-instance";
import { currentSession } from "@/lib/content/session";
import { ContentError } from "@/lib/content/types";
import { db } from "@/lib/db";

/**
 * POST /api/conteudo/arquivos — envio de imagem ou vídeo (só a equipe Dynamo).
 * Corpo: o arquivo cru. Consulta: orgId, e postId (+ cover=1 para a capa do Reels) ou avatar=1 (foto do perfil).
 * Fluxo contínuo para o disco: vídeo grande não passa pelo limite das ações de formulário.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session?.staff) return new Response(null, { status: 403 });

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId") ?? "";
  const postId = url.searchParams.get("postId");
  const length = request.headers.get("content-length");
  const upload = { body: request.body, contentLength: length && /^\d+$/.test(length) ? Number(length) : null };

  try {
    if (url.searchParams.get("avatar") === "1") return Response.json(await setAvatar(db, getStorage(), orgId, upload), { status: 201 });
    if (!postId) return Response.json({ error: "Informe o post." }, { status: 400 });
    const media = await attachMedia(db, getStorage(), orgId, postId, { ...upload, isCover: url.searchParams.get("cover") === "1" });
    return Response.json(media, { status: 201 });
  } catch (e) {
    if (e instanceof FileError) {
      const status = e.code === "tamanho" ? 413 : e.code === "tipo" ? 415 : 400;
      return Response.json({ error: e.message }, { status });
    }
    if (e instanceof ContentError) return Response.json({ error: e.message }, { status: 404 });
    console.error("Erro ao receber arquivo:", e);
    return Response.json({ error: "Não foi possível guardar o arquivo. Tente de novo." }, { status: 500 });
  }
}
