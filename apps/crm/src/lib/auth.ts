import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { db, schema } from "./db";

/**
 * Autenticação da área do cliente.
 * - Cada empresa cliente da Dynamo é uma "organization".
 * - A equipe Dynamo e os usuários do cliente são "members" com papéis (owner, admin, member).
 * - Cadastro público fica desligado: só a Dynamo cria acessos (convite).
 */
export const auth = betterAuth({
  appName: "Dynamo Business",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_SIGNUP !== "true",
    minPasswordLength: 10,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: false,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
