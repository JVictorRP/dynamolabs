/** Equipe da Dynamo: e-mails listados em DYNAMO_STAFF_EMAILS (separados por vírgula). */
export function isStaffEmail(email: string, list: string | undefined): boolean {
  const e = email.trim().toLowerCase();
  if (!e || !list) return false;
  return list
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}
