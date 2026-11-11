import { handleLinkDecision } from "@/lib/content/link";
import { onContentEvent } from "@/lib/content/hooks";
import { decisionLimiter } from "@/lib/content/link-instance";
import { clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const MAX_BODY = 4096;

/** POST /p/<código>/decisao — o cliente aprova ou pede ajuste. Sem login. Corpo: { postId, decision, comment? }. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return handleLinkDecision({ db, limiter: decisionLimiter, now: () => new Date(), onEvent: onContentEvent }, { token, ip: clientIp(request.headers), body });
}
