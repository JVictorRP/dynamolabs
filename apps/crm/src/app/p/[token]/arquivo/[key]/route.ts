import { serveLinkFile } from "@/lib/content/link";
import { fileLimiter } from "@/lib/content/link-instance";
import { getStorage } from "@/lib/content/storage-instance";
import { clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

/** GET /p/<código>/arquivo/<chave> — arquivo de um post que o link mostra. Sem login. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  return serveLinkFile(
    { db, storage: getStorage(), limiter: fileLimiter, now: () => new Date() },
    { token, key, ip: clientIp(request.headers), range: request.headers.get("range") },
  );
}
