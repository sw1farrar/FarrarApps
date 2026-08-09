"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createProjectThread,
  deleteProjectMessage,
  markThreadRead,
  sendProjectMessage,
  updateProjectMessage,
} from "@/lib/data/messaging";
import type { ProjectMessage, ProjectThread } from "@/lib/types/database";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ThreadWithUnread = ProjectThread & { unread?: number };

type MessageGroup = {
  authorId: string;
  profile: ProjectMessage["profiles"];
  messages: ProjectMessage[];
};

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86_400_000) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diff < 604_800_000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function isEdited(message: ProjectMessage) {
  if (!message.updated_at) return false;
  const created = new Date(message.created_at).getTime();
  const updated = new Date(message.updated_at).getTime();
  return updated - created > 1500;
}

function groupMessages(messages: ProjectMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.authorId === message.author_id) {
      last.messages.push(message);
      continue;
    }
    groups.push({
      authorId: message.author_id,
      profile: message.profiles,
      messages: [message],
    });
  }
  return groups;
}

const MESSAGE_SELECT =
  "id, thread_id, author_id, body, created_at, updated_at, profiles(id, email, full_name, role)";

export function ProjectMessaging({
  projectId,
  initialThreads,
  currentUserId,
  initialThreadId,
  className,
  contextHint = "Shared with client portal",
  canModerate = false,
}: {
  projectId: string;
  initialThreads: ThreadWithUnread[];
  currentUserId: string;
  initialThreadId?: string | null;
  className?: string;
  contextHint?: string | null;
  /** Staff can delete any message (not only their own). */
  canModerate?: boolean;
}) {
  const confirm = useConfirm();
  const [threads, setThreads] = React.useState(initialThreads);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialThreadId || initialThreads[0]?.id || null
  );
  const [messages, setMessages] = React.useState<ProjectMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newTopicOpen, setNewTopicOpen] = React.useState(false);
  const [topicTitle, setTopicTitle] = React.useState("");
  const [topicFirst, setTopicFirst] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const selected = threads.find((t) => t.id === selectedId) ?? null;
  const messageGroups = groupMessages(messages);
  const showThreadListOnMobile = !selectedId;

  const renderedGroups = React.useMemo(() => {
    let lastDay = "";
    return messageGroups.map((group) => {
      const firstMessage = group.messages[0];
      const day = dayLabel(firstMessage.created_at);
      const showDay = day !== lastDay;
      if (showDay) lastDay = day;
      return { group, day, showDay };
    });
  }, [messageGroups]);

  const loadMessages = React.useCallback(async (threadId: string) => {
    setLoadingMessages(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("project_messages")
      .select(MESSAGE_SELECT)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    setMessages((data as unknown as ProjectMessage[]) ?? []);
    setLoadingMessages(false);
    setEditingId(null);
    await markThreadRead(threadId);
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t))
    );
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project-messages-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
        },
        async (payload: { new: ProjectMessage }) => {
          const row = payload.new;
          const { data: thread } = await supabase
            .from("project_threads")
            .select("id, project_id")
            .eq("id", row.thread_id)
            .maybeSingle();
          if (!thread || thread.project_id !== projectId) return;

          if (row.thread_id === selectedId) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, email, full_name, role")
              .eq("id", row.author_id)
              .maybeSingle();
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, { ...row, profiles: profile ?? null }];
            });
            if (row.author_id !== currentUserId) {
              void markThreadRead(row.thread_id);
            }
          } else if (row.author_id !== currentUserId) {
            setThreads((prev) =>
              prev.map((t) =>
                t.id === row.thread_id
                  ? {
                      ...t,
                      unread: (t.unread || 0) + 1,
                      last_message_at: row.created_at,
                    }
                  : t
              )
            );
          }

          setThreads((prev) => {
            const next = prev.map((t) =>
              t.id === row.thread_id
                ? { ...t, last_message_at: row.created_at }
                : t
            );
            return [...next].sort(
              (a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "project_messages",
        },
        async (payload: { new: ProjectMessage }) => {
          const row = payload.new;
          if (row.thread_id !== selectedId) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    body: row.body,
                    updated_at: row.updated_at ?? m.updated_at,
                  }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "project_messages",
        },
        (payload: { old: { id?: string; thread_id?: string } }) => {
          const id = payload.old?.id;
          if (!id) return;
          setMessages((prev) => prev.filter((m) => m.id !== id));
          setEditingId((cur) => (cur === id ? null : cur));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, selectedId, currentUserId]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    const result = await sendProjectMessage({
      threadId: selectedId,
      body: draft,
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDraft("");
  }

  async function onCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const result = await createProjectThread({
      projectId,
      title: topicTitle,
      firstMessage: topicFirst,
    });
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("project_threads")
      .select("*")
      .eq("id", result.threadId)
      .single();
    if (data) {
      setThreads((prev) => [
        { ...(data as ProjectThread), unread: 0 },
        ...prev.filter((t) => t.id !== data.id),
      ]);
      setSelectedId(data.id);
    }
    setNewTopicOpen(false);
    setTopicTitle("");
    setTopicFirst("");
  }

  function selectThread(threadId: string) {
    setSelectedId(threadId);
  }

  function startEdit(message: ProjectMessage) {
    setEditingId(message.id);
    setEditDraft(message.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(messageId: string) {
    if (!editDraft.trim()) {
      toast.error("Message cannot be empty");
      return;
    }
    setSavingEdit(true);
    const result = await updateProjectMessage({
      messageId,
      body: editDraft,
    });
    setSavingEdit(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              body: editDraft.trim(),
              updated_at: new Date().toISOString(),
            }
          : m
      )
    );
    setEditingId(null);
    setEditDraft("");
    toast.success("Message updated");
  }

  async function onDeleteMessage(message: ProjectMessage) {
    const ok = await confirm({
      title: "Delete this message?",
      description: "This cannot be undone.",
      confirmLabel: "Delete message",
      variant: "destructive",
    });
    if (!ok) return;

    setDeletingId(message.id);
    const result = await deleteProjectMessage({ messageId: message.id });
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    if (editingId === message.id) cancelEdit();
    toast.success("Message deleted");
  }

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      <aside
        className={cn(
          "flex h-full min-h-0 w-full shrink-0 flex-col border-r border-border bg-muted/10 md:w-[260px]",
          showThreadListOnMobile ? "flex" : "hidden md:flex"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-xs font-medium text-foreground">Topics</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setNewTopicOpen(true)}
            aria-label="New topic"
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {threads.length ? (
            threads.map((thread) => {
              const active = thread.id === selectedId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-0.5 shrink-0 self-stretch rounded-full",
                      active ? "bg-primary" : "bg-transparent"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {thread.title}
                      </span>
                      {(thread.unread || 0) > 0 ? (
                        <span className="inline-flex min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          {thread.unread}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatThreadTime(thread.last_message_at)}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No topics yet. Start a conversation.
            </p>
          )}
        </div>
      </aside>

      <section
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background",
          showThreadListOnMobile ? "hidden md:flex" : "flex"
        )}
      >
        {selected ? (
          <>
            <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                onClick={() => setSelectedId(null)}
                aria-label="Back to topics"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selected.title}</p>
                {contextHint ? (
                  <p className="text-[11px] text-muted-foreground">
                    {contextHint}
                  </p>
                ) : null}
              </div>
            </header>

            <div
              ref={viewportRef}
              className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
              aria-live="polite"
            >
              {loadingMessages ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : messageGroups.length ? (
                renderedGroups.map(({ group, day, showDay }) => {
                  const name =
                    group.profile?.full_name ||
                    group.profile?.email ||
                    "User";
                  const isStaff =
                    group.profile?.role === "owner" ||
                    group.profile?.role === "staff";
                  const firstMessage = group.messages[0];

                  return (
                    <React.Fragment key={group.messages[0].id}>
                      {showDay ? (
                        <div className="my-2 flex items-center gap-2 px-2">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {day}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      ) : null}
                      <div className="group/msg flex gap-2 rounded-md px-2 py-1 hover:bg-muted/30">
                        <Avatar size="sm" className="mt-0.5">
                          <AvatarFallback className="text-[10px]">
                            {initials(
                              group.profile?.full_name,
                              group.profile?.email
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                            <span className="text-[13px] font-semibold text-foreground">
                              {name}
                            </span>
                            {isStaff ? (
                              <span className="text-[10px] text-muted-foreground">
                                Farrar Apps
                              </span>
                            ) : null}
                            <span className="text-[10px] text-muted-foreground">
                              {formatMessageTime(firstMessage.created_at)}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {group.messages.map((message) => {
                              const isOwn = message.author_id === currentUserId;
                              const canEdit = isOwn;
                              const canDelete = isOwn || canModerate;
                              const isEditing = editingId === message.id;
                              const isDeleting = deletingId === message.id;

                              if (isEditing) {
                                return (
                                  <div
                                    key={message.id}
                                    className="mt-1 space-y-1.5"
                                  >
                                    <Textarea
                                      value={editDraft}
                                      onChange={(e) =>
                                        setEditDraft(e.target.value)
                                      }
                                      rows={3}
                                      className="min-h-16 resize-y text-[13px]"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" &&
                                          (e.metaKey || e.ctrlKey)
                                        ) {
                                          e.preventDefault();
                                          void saveEdit(message.id);
                                        }
                                        if (e.key === "Escape") {
                                          e.preventDefault();
                                          cancelEdit();
                                        }
                                      }}
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        size="xs"
                                        onClick={() =>
                                          void saveEdit(message.id)
                                        }
                                        disabled={
                                          savingEdit || !editDraft.trim()
                                        }
                                      >
                                        {savingEdit ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <Check className="size-3" />
                                        )}
                                        Save
                                      </Button>
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        onClick={cancelEdit}
                                        disabled={savingEdit}
                                      >
                                        <X className="size-3" />
                                        Cancel
                                      </Button>
                                      <span className="text-[10px] text-muted-foreground">
                                        ⌘/Ctrl+Enter to save
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={message.id}
                                  className="group/line relative flex items-start gap-1"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="whitespace-pre-wrap text-[13px] leading-5 text-foreground/90">
                                      {message.body}
                                      {isEdited(message) ? (
                                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                                          (edited)
                                        </span>
                                      ) : null}
                                    </p>
                                  </div>
                                  {canEdit || canDelete ? (
                                    <div
                                      className={cn(
                                        "flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm",
                                        "opacity-100 sm:opacity-0 sm:group-hover/line:opacity-100 sm:group-focus-within/line:opacity-100",
                                        "transition-opacity"
                                      )}
                                    >
                                      {canEdit ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-xs"
                                          onClick={() => startEdit(message)}
                                          aria-label="Edit message"
                                          title="Edit"
                                        >
                                          <Pencil className="size-3" />
                                        </Button>
                                      ) : null}
                                      {canDelete ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-xs"
                                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() =>
                                            void onDeleteMessage(message)
                                          }
                                          disabled={isDeleting}
                                          aria-label="Delete message"
                                          title="Delete"
                                        >
                                          {isDeleting ? (
                                            <Loader2 className="size-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="size-3" />
                                          )}
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet. Send the first one below.
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={onSend}
              className="shrink-0 border-t border-border bg-background p-2"
            >
              <div className="flex items-end gap-1.5 rounded-lg border border-border bg-muted/20 p-1.5 focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message in ${selected.title}…`}
                  rows={1}
                  className="min-h-8 max-h-28 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-[13px] shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  className="shrink-0 rounded-md"
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </div>
              <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for a new line
              </p>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Pick a topic to read and reply.
            </p>
            <Button size="sm" onClick={() => setNewTopicOpen(true)}>
              <MessageSquarePlus className="size-4" />
              New topic
            </Button>
          </div>
        )}
      </section>

      <Dialog open={newTopicOpen} onOpenChange={setNewTopicOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New topic</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreateTopic} className="space-y-3">
            <Input
              placeholder="Topic title (e.g. Scope questions)"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              required
            />
            <Textarea
              placeholder="First message (optional)"
              rows={3}
              value={topicFirst}
              onChange={(e) => setTopicFirst(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNewTopicOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Create topic
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
