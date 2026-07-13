"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";

export async function submitPortalBrief(input: {
  projectId: string;
  customerId: string;
  name: string;
  fileCount: number;
}) {
  await logActivity({
    action: "brief_submitted",
    entity_type: "project",
    entity_id: input.projectId,
    meta: {
      customer_id: input.customerId,
      name: input.name,
      file_count: input.fileCount,
    },
  });

  const supabase = await createClient();
  await supabase.rpc("notify_staff", {
    p_title: "New client project brief",
    p_body: input.name,
    p_href: `/projects/${input.projectId}`,
  });
}
