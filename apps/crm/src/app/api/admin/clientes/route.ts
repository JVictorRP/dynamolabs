import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminToken } from "@/lib/admin";
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
  const header = request.headers.get("authorization") ?? "";
  return checkAdminToken(header.startsWith("Bearer ") ? header.slice(7) : "");
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
