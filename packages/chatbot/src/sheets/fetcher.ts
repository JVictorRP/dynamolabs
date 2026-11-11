/** Leitura de Google Sheets por conta de serviço da Dynamo (só leitura). */
import { JWT } from "google-auth-library";

export type SheetFetcher = (spreadsheetId: string, tab: string) => Promise<string[][]>;

export function parseSpreadsheetUrl(url: string): string | null {
  const m = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export function createGoogleSheetFetcher(
  serviceAccountJson: string,
  deps: { getToken?: () => Promise<string>; fetch?: typeof fetch } = {},
): SheetFetcher {
  const doFetch = deps.fetch ?? fetch;
  let jwt: JWT | null = null;
  const getToken =
    deps.getToken ??
    (async () => {
      if (!jwt) {
        const creds = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
        jwt = new JWT({
          email: creds.client_email,
          key: creds.private_key,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
      }
      const { token } = await jwt.getAccessToken();
      if (!token) throw new Error("Não foi possível autenticar a conta de serviço do Google.");
      return token;
    });

  return async (spreadsheetId, tab) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(tab)}`;
    const res = await doFetch(url, {
      headers: { Authorization: `Bearer ${await getToken()}` },
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as { values?: unknown[][]; error?: { message?: string } };
    if (!res.ok) {
      const hint = res.status === 403 || res.status === 404 ? " Confira se a planilha foi compartilhada com o e-mail da Dynamo e o nome da aba." : "";
      throw new Error(`Google Sheets respondeu ${res.status}: ${json.error?.message ?? "sem detalhes"}.${hint}`);
    }
    return (json.values ?? []).map((row) => row.map((c) => String(c ?? "")));
  };
}
