"use client";

import { useEffect } from "react";
import { usePrefs } from "@/lib/i18n/client";
import { Card, buttonClass } from "@/components/ui";

// Shown when a signed-in page fails to load. Nothing the person typed elsewhere is lost.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = usePrefs();
  useEffect(() => {
    // the digest matches the server log entry (Vercel → Logs) without exposing details here
    console.error("[3bdu] page error", error.digest ?? error.message);
  }, [error]);

  return (
    <Card>
      <h1 className="text-base font-semibold">{t("err.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("err.body")}</p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted" dir="ltr">
          ref: {error.digest}
        </p>
      )}
      <button type="button" onClick={reset} className={`${buttonClass} mt-4`}>
        {t("err.retry")}
      </button>
    </Card>
  );
}
