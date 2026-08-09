"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import type { ActionResult } from "@/lib/data/customers";
import type { ProjectStatus } from "@/lib/types/database";

export async function createProject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    name: String(formData.get("name") || "").trim(),
    customer_id: String(formData.get("customer_id") || ""),
    scope: String(formData.get("scope") || "").trim() || null,
    status: (String(formData.get("status") || "planning") as ProjectStatus),
    created_by: user?.id ?? null,
  };

  if (!payload.name) return { ok: false, error: "Name is required" };
  if (!payload.customer_id) return { ok: false, error: "Customer is required" };

  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "created",
    entity_type: "project",
    entity_id: data.id,
    meta: { name: payload.name },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${payload.customer_id}`);
  return { ok: true, id: data.id };
}

export async function updateProject(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    customer_id: String(formData.get("customer_id") || ""),
    scope: String(formData.get("scope") || "").trim() || null,
    status: String(formData.get("status") || "planning") as ProjectStatus,
  };

  if (!payload.name) return { ok: false, error: "Name is required" };
  if (!payload.customer_id) return { ok: false, error: "Customer is required" };

  const { error } = await supabase.from("projects").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "updated",
    entity_type: "project",
    entity_id: id,
    meta: { name: payload.name, status: payload.status },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name, customer_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "deleted",
    entity_type: "project",
    entity_id: id,
    meta: { name: project?.name ?? null },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  if (project?.customer_id) revalidatePath(`/customers/${project.customer_id}`);
  return { ok: true };
}

export async function addProjectMilestone(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const title = String(formData.get("title") || "").trim();
  const due_date = String(formData.get("due_date") || "").trim() || null;
  if (!title) return { ok: false, error: "Title is required" };

  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    title,
    due_date,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function toggleMilestone(
  milestoneId: string,
  projectId: string,
  completed: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestones")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", milestoneId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteProjectMilestone(
  milestoneId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: milestone } = await supabase
    .from("project_milestones")
    .select("title")
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "deleted",
    entity_type: "project_milestone",
    entity_id: milestoneId,
    meta: { project_id: projectId, title: milestone?.title ?? null },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function addProjectFileMeta(input: {
  projectId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("project_files").insert({
    project_id: input.projectId,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes ?? null,
    uploaded_by: user?.id ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true };
}

export async function getProjectFileSignedUrl(
  storagePath: string
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("project-files")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message || "Could not create file link" };
  }

  return { ok: true, url: data.signedUrl };
}

export async function deleteProjectFile(
  fileId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: file, error: fileError } = await supabase
    .from("project_files")
    .select("storage_path, file_name")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fileError || !file) {
    return { ok: false, error: fileError?.message || "File not found" };
  }

  const { error: storageError } = await supabase.storage
    .from("project-files")
    .remove([file.storage_path]);

  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("id", fileId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "deleted",
    entity_type: "project_file",
    entity_id: fileId,
    meta: {
      project_id: projectId,
      file_name: file.file_name,
      storage_remove_error: storageError?.message ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
