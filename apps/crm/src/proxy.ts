import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Checagem otimista: sem cookie de sessão → manda para o login.
 * A validação de verdade acontece em getOrgContext() em cada página.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // /p/... é o link de prévia do cliente: abre sem login (o código do link é a chave).
  matcher: ["/((?!login|sem-acesso|admin|api|p/|_next|favicon.ico).*)"],
};
