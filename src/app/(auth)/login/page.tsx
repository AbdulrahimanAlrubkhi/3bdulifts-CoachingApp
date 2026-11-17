import Link from "next/link";
import { getT } from "@/lib/i18n";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { login } from "../actions";

// A small form that reads ?error from the URL; it is fine for it to render on the server per request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { t } = await getT();
  const params = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.login")}</h1>
      <p className="mt-1 text-sm text-muted">{t("auth.tagline")}</p>

      {!supabaseConfigured && <p className="mt-6 text-sm text-danger">{t("setup.missing")}</p>}
      {params.error && <p className="mt-6 text-sm text-danger">{t("auth.error")}</p>}
      {params.notice === "confirm" && <p className="mt-6 text-sm text-accent">{t("auth.confirm")}</p>}

      <form action={login} className="mt-6 space-y-4">
        <Field label={t("auth.email")}>
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputClass} />
        </Field>
        <Field label={t("auth.password")}>
          <input name="password" type="password" required autoComplete="current-password" dir="ltr" className={inputClass} />
        </Field>
        <button type="submit" className={buttonClass}>
          {t("auth.login")}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="text-text underline underline-offset-4">
          {t("auth.signup")}
        </Link>
      </p>
    </>
  );
}
