"use server";

import { createClient } from "@/lib/supabase/server";
import { sendBrevoEmail } from "@/lib/email/brevo";
import type { ProjectMessage, ProjectThread } from "@/lib/types/database";

export async function listProjectThreads(
  projectId: string
): Promise<ProjectThread[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_threads")
    .select("*")
    .eq("project_id", projectId)
    .order("last_message_at", { ascending: false });

  return (data as ProjectThread[]) ?? [];
}

export async function listThreadMessages(
  threadId: string
): Promise<ProjectMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_messages")
    .select(
      "id, thread_id, author_id, body, created_at, updated_at, profiles(id, email, full_name, role)"
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return (data as unknown as ProjectMessage[]) ?? [];
}

export async function createProjectThread(input: {
  projectId: string;
  title: string;
  firstMessage?: string;
}): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Topic title is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: thread, error } = await supabase
    .from("project_threads")
    .insert({
      project_id: input.projectId,
      title,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !thread) {
    return { ok: false, error: error?.message || "Could not create topic" };
  }

  const body = input.firstMessage?.trim();
  if (body) {
    const sent = await sendProjectMessage({
      threadId: thread.id,
      body,
      skipEmail: false,
    });
    if (!sent.ok) {
      return { ok: true, threadId: thread.id };
    }
  }

  return { ok: true, threadId: thread.id };
}

export async function sendProjectMessage(input: {
  threadId: string;
  body: string;
  skipEmail?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message cannot be empty" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: message, error } = await supabase
    .from("project_messages")
    .insert({
      thread_id: input.threadId,
      author_id: user.id,
      body,
    })
    .select("id")
    .single();

  if (error || !message) {
    return { ok: false, error: error?.message || "Could not send message" };
  }

  await supabase.from("project_thread_reads").upsert({
    thread_id: input.threadId,
    user_id: user.id,
    last_read_at: new Date().toISOString(),
  });

  if (!input.skipEmail) {
    void emailProjectMessageDigest({
      threadId: input.threadId,
      authorId: user.id,
      body,
    }).catch(() => undefined);
  }

  return { ok: true, id: message.id };
}

export async function updateProjectMessage(input: {
  messageId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message cannot be empty" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: existing, error: loadError } = await supabase
    .from("project_messages")
    .select("id, author_id")
    .eq("id", input.messageId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: loadError?.message || "Message not found" };
  }
  if (existing.author_id !== user.id) {
    return { ok: false, error: "You can only edit your own messages" };
  }

  const { error } = await supabase
    .from("project_messages")
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.messageId)
    .eq("author_id", user.id);

  if (error) {
    return { ok: false, error: error.message || "Could not update message" };
  }

  return { ok: true };
}

export async function deleteProjectMessage(input: {
  messageId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: existing, error: loadError } = await supabase
    .from("project_messages")
    .select("id, author_id")
    .eq("id", input.messageId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: loadError?.message || "Message not found" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isStaff =
    profile?.role === "owner" || profile?.role === "staff";
  if (existing.author_id !== user.id && !isStaff) {
    return { ok: false, error: "You can only delete your own messages" };
  }

  const query = supabase
    .from("project_messages")
    .delete()
    .eq("id", input.messageId);

  // Staff can delete any message they can access; authors only their own.
  // RLS enforces thread access + author/staff.
  const { error } = isStaff
    ? await query
    : await query.eq("author_id", user.id);

  if (error) {
    return { ok: false, error: error.message || "Could not delete message" };
  }

  return { ok: true };
}

export async function markThreadRead(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("project_thread_reads").upsert({
    thread_id: threadId,
    user_id: user.id,
    last_read_at: new Date().toISOString(),
  });
}

export async function getProjectUnreadCounts(
  projectIds: string[]
): Promise<Record<string, number>> {
  if (!projectIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("project_unread_counts", {
    p_project_ids: projectIds,
  });

  const map: Record<string, number> = {};
  for (const row of (data as { project_id: string; unread_count: number }[]) ??
    []) {
    map[row.project_id] = Number(row.unread_count) || 0;
  }
  return map;
}

export async function getThreadUnreadCounts(
  threadIds: string[]
): Promise<Record<string, number>> {
  if (!threadIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("thread_unread_counts", {
    p_thread_ids: threadIds,
  });

  const map: Record<string, number> = {};
  for (const row of (data as { thread_id: string; unread_count: number }[]) ??
    []) {
    map[row.thread_id] = Number(row.unread_count) || 0;
  }
  return map;
}


async function emailProjectMessageDigest(input: {
  threadId: string;
  authorId: string;
  body: string;
}) {
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("project_threads")
    .select("id, title, project_id, projects(id, name, customer_id)")
    .eq("id", input.threadId)
    .single();

  if (!thread) return;

  const project = thread.projects as unknown as {
    id: string;
    name: string;
    customer_id: string;
  } | null;
  if (!project) return;

  const { data: author } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", input.authorId)
    .single();

  const authorName =
    author?.full_name || author?.email || "Someone";

  const { data: members } = await supabase
    .from("customer_members")
    .select("user_id, profiles(email, full_name)")
    .eq("customer_id", project.customer_id);

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("role", ["owner", "staff"]);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://farrarapps.com";

  const recipients = new Map<
    string,
    { email: string; name: string; href: string }
  >();

  for (const s of staff ?? []) {
    if (!s.email || s.id === input.authorId) continue;
    recipients.set(s.email.toLowerCase(), {
      email: s.email,
      name: s.full_name || s.email,
      href: `${siteUrl}/projects/${project.id}?thread=${input.threadId}`,
    });
  }

  for (const m of members ?? []) {
    if (m.user_id === input.authorId) continue;
    const profile = m.profiles as unknown as {
      email: string | null;
      full_name: string | null;
    } | null;
    if (!profile?.email) continue;
    recipients.set(profile.email.toLowerCase(), {
      email: profile.email,
      name: profile.full_name || profile.email,
      href: `${siteUrl}/portal/projects/${project.id}?thread=${input.threadId}`,
    });
  }

  const snippet = input.body.slice(0, 240);
  for (const r of recipients.values()) {
    await sendBrevoEmail({
      toEmail: r.email,
      toName: r.name,
      subject: `New message on ${project.name}: ${thread.title}`,
      htmlContent: `<p><strong>${authorName}</strong> wrote in <em>${thread.title}</em> on project <strong>${project.name}</strong>:</p><p>${snippet.replace(/</g, "&lt;")}</p><p><a href="${r.href}">Open conversation</a></p>`,
      textContent: `${authorName} wrote in ${thread.title} on ${project.name}:\n\n${snippet}\n\n${r.href}`,
    });
  }
}
