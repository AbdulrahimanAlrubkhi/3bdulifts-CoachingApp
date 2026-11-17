import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { FOOD_COLUMNS, normalizeFood, type Food } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { Card, ghostButtonClass } from "@/components/ui";
import { FoodsBrowser } from "./FoodsBrowser";

export default async function FoodsPage() {
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("foods").select(FOOD_COLUMNS).order(locale === "ar" ? "name_ar" : "name_en");
  const foods = ((data ?? []) as Food[]).map(normalizeFood);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t("n.foods")}</h1>
        <Link href="/coach/library/foods/new" className={`${ghostButtonClass} flex items-center`}>
          + {t("n.newFood")}
        </Link>
      </div>
      <p className="-mt-2 mb-3 text-sm text-muted">
        <span className="num">{foods.length}</span> · {t("n.per100")}
      </p>
      <Card className="py-2">
        <FoodsBrowser foods={foods} />
      </Card>
    </>
  );
}
