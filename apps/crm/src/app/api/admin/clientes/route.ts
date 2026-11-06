import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, OnboardingError } from "@/lib/onboarding";

/**
 * POST /api/admin/clientes — cadastra um cliente novo (uso interno da Dynamo).
 * Header: Authorization: Bearer <ADMIN_TOKEN>
 * Corpo: { "empresa", "nome", "email", "senha", "demo"?: boolean }
 * Resposta: login criado + chave de API do n8n (mostrada só nesta resposta).
 */
const bodySchema = z.object({
  empresa: z.string().trim().min(2).max(120),
  nome: z.string().trim().min(2).max(120),
  email: z.email(),
  senha: z.string().min(10).max(200),
  demo: z.boolean().optional(),
});

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 32) return false; // rota desligada sem um token forte
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(given), h(expected));
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: z.treeifyError(parsed.error) }, { status: 400 });
  }
  try {
    return NextResponse.json(await createClient(parsed.data), { status: 201 });
  } catch (e) {
    if (e instanceof OnboardingError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
