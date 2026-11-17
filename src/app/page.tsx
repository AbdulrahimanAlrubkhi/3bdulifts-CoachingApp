import { redirect } from "next/navigation";
import { homeFor, requireProfile } from "@/lib/auth";

// "/" just routes each role to its home screen.
export default async function Index() {
  const profile = await requireProfile();
  redirect(homeFor(profile));
}
