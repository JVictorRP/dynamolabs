import { eq } from "drizzle-orm";
import { schema, type Db } from "@dynamo/db";
import { ContentError } from "./types";

export type Profile = { handle: string; displayName: string; avatarKey: string | null; bio: string; link: string };

export async function getProfile(db: Db, organizationId: string): Promise<Profile> {
  const [p] = await db.select().from(schema.contentProfile).where(eq(schema.contentProfile.organizationId, organizationId));
  return { handle: p?.handle ?? "", displayName: p?.displayName ?? "", avatarKey: p?.avatarFileKey ?? null, bio: p?.bio ?? "", link: p?.link ?? "" };
}

/** Salva o perfil do Instagram (a foto é enviada à parte e continua como está). */
export async function saveProfile(db: Db, organizationId: string, input: { handle: string; displayName: string; bio: string; link: string }): Promise<void> {
  const handle = input.handle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{0,30}$/.test(handle)) throw new ContentError("Usuário inválido: use letras, números, ponto e sublinhado, até 30 caracteres.");
  const bio = input.bio.replace(/\r\n/g, "\n").trim();
  if (bio.length > 150) throw new ContentError("A bio passa de 150 caracteres, o limite do Instagram.");
  const link = input.link.trim();
  if (link.length > 200 || /\s/.test(link)) throw new ContentError("O link do perfil é inválido (sem espaços, até 200 caracteres).");
  const displayName = input.displayName.trim().slice(0, 80);
  await db
    .insert(schema.contentProfile)
    .values({ organizationId, handle, displayName, bio, link })
    .onConflictDoUpdate({ target: schema.contentProfile.organizationId, set: { handle, displayName, bio, link } });
}
