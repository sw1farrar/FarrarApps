import { createClient } from "@/lib/supabase/server";

/** Portal access for a CRM customer (not a staff profile). */
export type PortalAccessStatus = "active" | "pending" | "none";

export function derivePortalAccessStatus(input: {
  memberCount: number;
  pendingInviteCount: number;
  portalUserId?: string | null;
}): PortalAccessStatus {
  if (input.memberCount > 0 || input.portalUserId) return "active";
  if (input.pendingInviteCount > 0) return "pending";
  return "none";
}

/**
 * Batch portal status for customer list. Uses members + pending invites + legacy portal_user_id.
 */
export async function getPortalAccessStatuses(
  customers: { id: string; portal_user_id?: string | null }[]
): Promise<Record<string, PortalAccessStatus>> {
  const map: Record<string, PortalAccessStatus> = {};
  if (!customers.length) return map;

  for (const c of customers) {
    map[c.id] = c.portal_user_id ? "active" : "none";
  }

  const ids = customers.map((c) => c.id);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("customer_members")
      .select("customer_id")
      .in("customer_id", ids),
    supabase
      .from("portal_invites")
      .select("customer_id")
      .in("customer_id", ids)
      .is("accepted_at", null)
      .gt("expires_at", now),
  ]);

  const memberCounts = new Map<string, number>();
  for (const row of members ?? []) {
    const id = row.customer_id as string;
    memberCounts.set(id, (memberCounts.get(id) || 0) + 1);
  }
  const inviteCounts = new Map<string, number>();
  for (const row of invites ?? []) {
    const id = row.customer_id as string;
    inviteCounts.set(id, (inviteCounts.get(id) || 0) + 1);
  }

  for (const c of customers) {
    map[c.id] = derivePortalAccessStatus({
      memberCount: memberCounts.get(c.id) || 0,
      pendingInviteCount: inviteCounts.get(c.id) || 0,
      portalUserId: c.portal_user_id,
    });
  }

  return map;
}

export type ClientPortalLink = {
  userId: string;
  customerIds: string[];
  customerNames: string[];
};

/** Map client profile ids → linked customer names (membership + legacy portal_user_id). */
export async function getClientPortalLinks(
  userIds: string[]
): Promise<Record<string, ClientPortalLink>> {
  const result: Record<string, ClientPortalLink> = {};
  if (!userIds.length) return result;

  for (const id of userIds) {
    result[id] = { userId: id, customerIds: [], customerNames: [] };
  }

  const supabase = await createClient();
  const [{ data: members }, { data: legacy }] = await Promise.all([
    supabase
      .from("customer_members")
      .select("user_id, customer_id, customers(id, name)")
      .in("user_id", userIds),
    supabase
      .from("customers")
      .select("id, name, portal_user_id")
      .in("portal_user_id", userIds),
  ]);

  function add(userId: string, customerId: string, name: string) {
    const entry = result[userId] ?? {
      userId,
      customerIds: [],
      customerNames: [],
    };
    if (!entry.customerIds.includes(customerId)) {
      entry.customerIds.push(customerId);
      entry.customerNames.push(name);
    }
    result[userId] = entry;
  }

  for (const row of members ?? []) {
    const cust = row.customers as unknown as { id: string; name: string } | null;
    if (cust) add(row.user_id as string, cust.id, cust.name);
  }
  for (const row of legacy ?? []) {
    if (row.portal_user_id) {
      add(row.portal_user_id as string, row.id as string, row.name as string);
    }
  }

  return result;
}
