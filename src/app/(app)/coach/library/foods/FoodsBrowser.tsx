"use client";

import Link from "next/link";
import type { Food } from "@/lib/nutrition";
import { FoodList, foodRowClass } from "@/components/FoodList";

export function FoodsBrowser({ foods }: { foods: Food[] }) {
  return (
    <FoodList
      foods={foods}
      row={(food, body) => (
        <Link href={`/coach/library/foods/${food.id}`} className={foodRowClass}>
          {body}
        </Link>
      )}
    />
  );
}
