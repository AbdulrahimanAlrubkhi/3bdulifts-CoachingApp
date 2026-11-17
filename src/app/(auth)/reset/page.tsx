import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { setNewPassword } from "../actions";

export const instant = false;

// Reached from the reset email: /auth/callback has already signed the person in.
export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  if (!(await getProfile())) redirect("/login?error=link");
  const { t } = await getT();
  const { error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.forgotTitle")}</h1>
      {error && <p className="mt-6 text-sm text-danger">{t("auth.resetError")}</p>}
      <form action={setNewPassword} className="mt-6 space-y-4">
        <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={inputClass} />
        </Field>
        <button className={buttonClass}>{t("auth.setPassword")}</button>
      </form>
    </>
  );
}
