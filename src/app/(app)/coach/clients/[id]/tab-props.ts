import type { ClientRow } from "@/lib/clients";
import type { TKey } from "@/lib/i18n/dictionaries";

export type TabProps = {
  clientId: string;
  client: ClientRow;
  name: string;
  t: (key: TKey) => string;
  locale: "ar" | "en";
  unit: "kg" | "lb";
  sp: Record<string, string | string[] | undefined>;
};
