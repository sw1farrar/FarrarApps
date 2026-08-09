import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types/database";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, company, email")
    .order("name", { ascending: true });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>{" "}
          / New
        </p>
        <h1 className="text-lg font-semibold tracking-tight">New project</h1>
      </div>
      <ProjectForm
        customers={(data ?? []) as Customer[]}
        defaultCustomerId={customerId}
      />
    </div>
  );
}
