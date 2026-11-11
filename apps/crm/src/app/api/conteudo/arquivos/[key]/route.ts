import { findFileOwner } from "@/lib/content/media";
import { neutralNotFound, serveFile } from "@/lib/content/files";
import { canSeeOrganization, currentSession } from "@/lib/content/session";
import { getStorage } from "@/lib/content/storage-instance";
import { db } from "@/lib/db";

/** GET /api/conteudo/arquivos/<chave> — entrega para a equipe ou para quem é da empresa dona do arquivo. */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const session = await currentSession();
  if (!session) return neutralNotFound();
  const owner = await findFileOwner(db, key);
  if (!owner || !(await canSeeOrganization(session, owner))) return neutralNotFound();
  return serveFile(getStorage(), { organizationId: owner, key, range: request.headers.get("range") });
}
