import Link from "next/link";
import { getT } from "@/lib/i18n";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { requestPasswordReset } from "../actions";

// A small form that reads ?sent from the URL; it is fine for it to render on the server per request.
export const instant = false;

export default async function ForgotPage({ searchParams }: PageProps<"/forgot">) {
  const { t } = await getT();
  const { sent } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.forgotTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("auth.forgotIntro")}</p>
      {sent ? (
        <p className="mt-6 text-sm text-accent" role="status">
          {t("auth.linkSent")}
        </p>
      ) : (
        <form action={requestPasswordReset} className="mt-6 space-y-4">
          <Field label={t("auth.email")}>
            <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputClass} />
          </Field>
          <button className={buttonClass}>{t("auth.sendLink")}</button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-text underline underline-offset-4">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </>
  );
}
