import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types/database";
import { CategoriesManager } from "@/components/settings/settings-panels";

export default async function FinanceCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, type")
    .order("name");

  return (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <CategoriesManager categories={(categories ?? []) as Category[]} />
      </div>
    </div>
  );
}
