/**
 * Logs a failure so it shows up in the server logs (Vercel → Logs) without any client data:
 * only where it happened and the database/auth error code and message, never form values,
 * names, notes or numbers.
 */
export function logError(where: string, error: unknown) {
  if (!error) return;
  const e = error as { code?: string; message?: string; status?: number };
  console.error(`[3bdu] ${where} failed`, { code: e.code ?? e.status ?? null, message: (e.message ?? String(error)).slice(0, 200) });
}
