import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { isStaffEmail } from "./staff-core";

export const isStaff = (email: string) => isStaffEmail(email, process.env.DYNAMO_STAFF_EMAILS);

/** Só a equipe da Dynamo (DYNAMO_STAFF_EMAILS) entra na área de clientes. */
export async function requireStaff() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!isStaff(session.user.email)) redirect("/");
  return session.user;
}
