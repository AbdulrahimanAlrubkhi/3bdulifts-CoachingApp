import Link from "next/link";
import { getT } from "@/lib/i18n";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { signup } from "../actions";

// A small form that reads ?error from the URL; it is fine for it to render on the server per request.
export const instant = false;

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { t } = await getT();
  const params = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signup")}</h1>
      <p className="mt-1 text-sm text-muted">{t("auth.tagline")}</p>

      {!supabaseConfigured && <p className="mt-6 text-sm text-danger">{t("setup.missing")}</p>}
      {params.error && <p className="mt-6 text-sm text-danger">{t("auth.signupError")}</p>}

      <form action={signup} className="mt-6 space-y-4">
        <Field label={t("auth.name")}>
          <input name="name" type="text" required autoComplete="name" className={inputClass} />
        </Field>
        <Field label={t("auth.email")}>
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputClass} />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={inputClass} />
        </Field>
        <button type="submit" className={buttonClass}>
          {t("auth.signup")}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-text underline underline-offset-4">
          {t("auth.login")}
        </Link>
      </p>
    </>
  );
}
