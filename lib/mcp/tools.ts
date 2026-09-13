import { createClient } from "@/lib/supabase/server";
import { listActivity } from "@/lib/data/activity";
import { getAccountsReceivableOverview } from "@/lib/data/balances";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/data/customers";
import { getDashboardData } from "@/lib/data/dashboard";
import {
  createInvoice,
  deleteInvoice,
  getInvoiceWorkbenchData,
  recordInvoicePayment,
  sendInvoiceEmail,
  updateInvoice,
  updateInvoiceStatus,
} from "@/lib/data/invoices";
import {
  createProjectThread,
  listProjectThreads,
  listThreadMessages,
  sendProjectMessage,
} from "@/lib/data/messaging";
import { inviteCustomerToPortal } from "@/lib/data/portal";
import {
  addProjectMilestone,
  createProject,
  deleteProject,
  deleteProjectMilestone,
  toggleMilestone,
  updateProject,
} from "@/lib/data/projects";
import {
  completeReconciliation,
  getReconciliation,
  listReconciliations,
  setReconciliationItems,
  startReconciliation,
  voidReconciliation,
} from "@/lib/data/reconciliations";
import { getReportsBundle } from "@/lib/data/reports";
import {
  createAccount,
  createCategory,
  deleteCategory,
  setAccountActive,
  updateCompanySettings,
  updateUserRole,
} from "@/lib/data/settings";
import { inviteStaffMember } from "@/lib/data/staff";
import {
  createTransaction,
  deleteTransaction,
  setTransactionReconciled,
  updateTransaction,
} from "@/lib/data/transactions";
import {
  McpToolError,
  clampLimit,
  formFrom,
  getMcpProfile,
  optionalBool,
  optionalNumber,
  optionalString,
  requireString,
  runAsMcpUser,
  unwrapAction,
} from "@/lib/mcp/session";
import type { InvoiceStatus, ProjectStatus, UserRole } from "@/lib/types/database";

export type JsonSchema = {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (userId: string, args: Record<string, unknown>) => Promise<unknown>;
};

function str(args: Record<string, unknown>, key: string) {
  return optionalString(args[key]);
}

function num(args: Record<string, unknown>, key: string) {
  return optionalNumber(args[key]);
}

function bool(args: Record<string, unknown>, key: string) {
  return optionalBool(args[key]);
}

function asUser<T>(userId: string, fn: () => Promise<T>) {
  return runAsMcpUser(userId, fn);
}

function ilike(q: string) {
  return `%${q.replace(/[%_,]/g, "")}%`;
}

const lineSchema = {
  type: "array",
  description: "Invoice lines.",
  items: {
    type: "object",
    properties: {
      description: { type: "string" },
      quantity: { type: "number" },
      rate: { type: "number" },
      service_date: { type: "string", description: "YYYY-MM-DD" },
    },
  },
};

function parseLines(args: Record<string, unknown>) {
  const raw = args.lines;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      const row = line as Record<string, unknown>;
      const description = typeof row.description === "string" ? row.description : "";
      return {
        description,
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        service_date:
          typeof row.service_date === "string" ? row.service_date : null,
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "whoami",
    description: "Show the Farrar Apps account Grok is acting as.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) => getMcpProfile(userId),
  },
  {
    name: "get_dashboard",
    description: "Workspace dashboard: KPIs, AR, cash this month, attention items, active projects.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) =>
      asUser(userId, async () => {
        const data = await getDashboardData();
        return {
          range: data.range,
          kpis: data.kpis,
          cash: {
            income: data.cash.income,
            expenses: data.cash.expenses,
            profit: data.cash.profit,
          },
          arByCustomer: data.arByCustomer,
          attention: data.attention,
          projects: data.projects,
          draftInvoiceCount: data.draftInvoiceCount,
          recentActivity: data.recentActivity,
        };
      }),
  },
  {
    name: "get_reports",
    description: "Cash-basis P&L and AR for a date range (defaults to this month).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const bundle = await getReportsBundle(str(args, "from"), str(args, "to"));
        return {
          from: bundle.from,
          to: bundle.to,
          income: bundle.income,
          expenses: bundle.expenses,
          profit: bundle.profit,
          transfers: bundle.transfers,
          incomeCount: bundle.incomeCount,
          expenseCount: bundle.expenseCount,
          expensesByCategory: bundle.expensesByCategory,
          incomeByCustomer: bundle.incomeByCustomer,
          incomeByCategory: bundle.incomeByCategory,
          ar: bundle.ar.totals,
        };
      }),
  },
  {
    name: "get_ar",
    description: "Open invoices and accounts receivable by customer.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) => asUser(userId, () => getAccountsReceivableOverview()),
  },
  {
    name: "list_activity",
    description: "Recent workspace activity.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        entity_type: { type: "string" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, () =>
        listActivity({
          limit: clampLimit(num(args, "limit"), 25, 100),
          entity_type: str(args, "entity_type"),
        })
      ),
  },
  {
    name: "list_customers",
    description: "List customers. Optional search across name, company, email, address.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        let query = supabase
          .from("customers")
          .select(
            "id, name, company, email, phone, city, state, zip, portal_user_id, updated_at"
          )
          .order("name")
          .limit(clampLimit(num(args, "limit")));
        const q = str(args, "query");
        if (q) {
          const pattern = ilike(q);
          query = query.or(
            `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`
          );
        }
        const { data, error } = await query;
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "get_customer",
    description: "Get a customer by id.",
    inputSchema: {
      type: "object",
      properties: { customer_id: { type: "string" } },
      required: ["customer_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("id", requireString(args.customer_id, "customer_id"))
          .maybeSingle();
        if (error) throw new McpToolError(error.message);
        if (!data) throw new McpToolError("Customer not found.");
        return data;
      }),
  },
  {
    name: "create_customer",
    description: "Create a customer. Optionally send a portal invite if email is set.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        zip: { type: "string" },
        notes: { type: "string" },
        send_portal_invite: { type: "boolean" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await createCustomer(
            formFrom(args, [
              "name",
              "email",
              "phone",
              "company",
              "address",
              "city",
              "state",
              "zip",
              "notes",
              "send_portal_invite",
            ])
          )
        )
      ),
  },
  {
    name: "update_customer",
    description: "Update a customer.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        zip: { type: "string" },
        notes: { type: "string" },
      },
      required: ["customer_id", "name"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateCustomer(
            requireString(args.customer_id, "customer_id"),
            formFrom(args, [
              "name",
              "email",
              "phone",
              "company",
              "address",
              "city",
              "state",
              "zip",
              "notes",
            ])
          )
        )
      ),
  },
  {
    name: "delete_customer",
    description: "Delete a customer.",
    inputSchema: {
      type: "object",
      properties: { customer_id: { type: "string" } },
      required: ["customer_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(await deleteCustomer(requireString(args.customer_id, "customer_id")))
      ),
  },
  {
    name: "invite_customer_portal",
    description: "Email a portal invite to the customer's primary email.",
    inputSchema: {
      type: "object",
      properties: { customer_id: { type: "string" } },
      required: ["customer_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await inviteCustomerToPortal(requireString(args.customer_id, "customer_id"))
        )
      ),
  },
  {
    name: "list_projects",
    description: "List projects. Optional search and status filter.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: {
          type: "string",
          enum: ["planning", "in_progress", "delivered", "archived"],
        },
        customer_id: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        let query = supabase
          .from("projects")
          .select("id, name, status, customer_id, updated_at, customers(id, name)")
          .order("updated_at", { ascending: false })
          .limit(clampLimit(num(args, "limit")));
        const status = str(args, "status") as ProjectStatus | undefined;
        if (status) query = query.eq("status", status);
        const customerId = str(args, "customer_id");
        if (customerId) query = query.eq("customer_id", customerId);
        const q = str(args, "query");
        if (q) query = query.ilike("name", ilike(q));
        const { data, error } = await query;
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "get_project",
    description: "Get a project with milestones and recent invoices.",
    inputSchema: {
      type: "object",
      properties: { project_id: { type: "string" } },
      required: ["project_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const id = requireString(args.project_id, "project_id");
        const supabase = await createClient();
        const [{ data: project, error }, { data: milestones }, { data: invoices }] =
          await Promise.all([
            supabase
              .from("projects")
              .select("*, customers(id, name, email)")
              .eq("id", id)
              .maybeSingle(),
            supabase
              .from("project_milestones")
              .select("*")
              .eq("project_id", id)
              .order("sort_order")
              .order("created_at"),
            supabase
              .from("invoices")
              .select("id, invoice_number, status, total, due_date")
              .eq("project_id", id)
              .order("issue_date", { ascending: false })
              .limit(20),
          ]);
        if (error) throw new McpToolError(error.message);
        if (!project) throw new McpToolError("Project not found.");
        return { project, milestones: milestones ?? [], invoices: invoices ?? [] };
      }),
  },
  {
    name: "create_project",
    description: "Create a project for a customer.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        customer_id: { type: "string" },
        scope: { type: "string" },
        status: {
          type: "string",
          enum: ["planning", "in_progress", "delivered", "archived"],
        },
      },
      required: ["name", "customer_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await createProject(formFrom(args, ["name", "customer_id", "scope", "status"]))
        )
      ),
  },
  {
    name: "update_project",
    description: "Update a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        name: { type: "string" },
        customer_id: { type: "string" },
        scope: { type: "string" },
        status: {
          type: "string",
          enum: ["planning", "in_progress", "delivered", "archived"],
        },
      },
      required: ["project_id", "name", "customer_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateProject(
            requireString(args.project_id, "project_id"),
            formFrom(args, ["name", "customer_id", "scope", "status"])
          )
        )
      ),
  },
  {
    name: "delete_project",
    description: "Delete a project.",
    inputSchema: {
      type: "object",
      properties: { project_id: { type: "string" } },
      required: ["project_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(await deleteProject(requireString(args.project_id, "project_id")))
      ),
  },
  {
    name: "add_project_milestone",
    description: "Add a milestone to a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        title: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["project_id", "title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await addProjectMilestone(
            requireString(args.project_id, "project_id"),
            formFrom(args, ["title", "due_date"])
          )
        )
      ),
  },
  {
    name: "toggle_project_milestone",
    description: "Mark a project milestone complete or incomplete.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        milestone_id: { type: "string" },
        completed: { type: "boolean" },
      },
      required: ["project_id", "milestone_id", "completed"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await toggleMilestone(
            requireString(args.milestone_id, "milestone_id"),
            requireString(args.project_id, "project_id"),
            Boolean(args.completed)
          )
        )
      ),
  },
  {
    name: "delete_project_milestone",
    description: "Delete a project milestone.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        milestone_id: { type: "string" },
      },
      required: ["project_id", "milestone_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await deleteProjectMilestone(
            requireString(args.milestone_id, "milestone_id"),
            requireString(args.project_id, "project_id")
          )
        )
      ),
  },
  {
    name: "list_project_threads",
    description: "List message threads on a project.",
    inputSchema: {
      type: "object",
      properties: { project_id: { type: "string" } },
      required: ["project_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, () =>
        listProjectThreads(requireString(args.project_id, "project_id"))
      ),
  },
  {
    name: "list_thread_messages",
    description: "List messages in a project thread.",
    inputSchema: {
      type: "object",
      properties: { thread_id: { type: "string" } },
      required: ["thread_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, () =>
        listThreadMessages(requireString(args.thread_id, "thread_id"))
      ),
  },
  {
    name: "create_project_thread",
    description: "Start a project message thread, optionally with a first message.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        title: { type: "string" },
        first_message: { type: "string" },
      },
      required: ["project_id", "title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, () =>
        createProjectThread({
          projectId: requireString(args.project_id, "project_id"),
          title: requireString(args.title, "title"),
          firstMessage: str(args, "first_message"),
        })
      ),
  },
  {
    name: "send_project_message",
    description: "Send a message on a project thread.",
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string" },
        body: { type: "string" },
      },
      required: ["thread_id", "body"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, () =>
        sendProjectMessage({
          threadId: requireString(args.thread_id, "thread_id"),
          body: requireString(args.body, "body"),
        })
      ),
  },
  {
    name: "list_invoices",
    description: "List invoices. Filter by status, customer, or invoice number.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: { type: "string", enum: ["draft", "sent", "paid", "overdue"] },
        customer_id: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        let query = supabase
          .from("invoices")
          .select(
            "id, invoice_number, status, issue_date, due_date, total, customer_id, project_id, customers(id, name)"
          )
          .order("issue_date", { ascending: false })
          .limit(clampLimit(num(args, "limit")));
        const status = str(args, "status") as InvoiceStatus | undefined;
        if (status) query = query.eq("status", status);
        const customerId = str(args, "customer_id");
        if (customerId) query = query.eq("customer_id", customerId);
        const q = str(args, "query");
        if (q) query = query.ilike("invoice_number", ilike(q));
        const { data, error } = await query;
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "get_invoice",
    description: "Get an invoice with line items, customer, and totals.",
    inputSchema: {
      type: "object",
      properties: { invoice_id: { type: "string" } },
      required: ["invoice_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const result = await getInvoiceWorkbenchData(
          requireString(args.invoice_id, "invoice_id")
        );
        if (!result.ok) throw new McpToolError(result.error);
        const { invoice, lines, customer, cardFee } = result.data;
        return { invoice, lines, customer, cardFee };
      }),
  },
  {
    name: "create_invoice",
    description: "Create an invoice with line items. Drafts may omit customer/lines if allow_incomplete is true.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        project_id: { type: "string" },
        issue_date: { type: "string" },
        due_date: { type: "string" },
        notes: { type: "string" },
        tax: { type: "number" },
        allow_incomplete: { type: "boolean" },
        lines: lineSchema,
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await createInvoice({
            customer_id: str(args, "customer_id") ?? null,
            project_id: str(args, "project_id") ?? null,
            issue_date: str(args, "issue_date") ?? null,
            due_date: str(args, "due_date") ?? null,
            notes: str(args, "notes") ?? null,
            tax: num(args, "tax") ?? 0,
            lines: parseLines(args),
            allowIncomplete: bool(args, "allow_incomplete") === true,
          })
        )
      ),
  },
  {
    name: "update_invoice",
    description: "Update a draft invoice.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        customer_id: { type: "string" },
        project_id: { type: "string" },
        issue_date: { type: "string" },
        due_date: { type: "string" },
        notes: { type: "string" },
        tax: { type: "number" },
        allow_incomplete: { type: "boolean" },
        lines: lineSchema,
      },
      required: ["invoice_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateInvoice(requireString(args.invoice_id, "invoice_id"), {
            customer_id: str(args, "customer_id") ?? null,
            project_id: str(args, "project_id") ?? null,
            issue_date: str(args, "issue_date") ?? null,
            due_date: str(args, "due_date") ?? null,
            notes: str(args, "notes") ?? null,
            tax: num(args, "tax") ?? 0,
            lines: parseLines(args),
            allowIncomplete: bool(args, "allow_incomplete") === true,
          })
        )
      ),
  },
  {
    name: "delete_invoice",
    description: "Delete an unpaid invoice. Paid invoices cannot be deleted.",
    inputSchema: {
      type: "object",
      properties: { invoice_id: { type: "string" } },
      required: ["invoice_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(await deleteInvoice(requireString(args.invoice_id, "invoice_id")))
      ),
  },
  {
    name: "set_invoice_status",
    description: "Set invoice status to draft, sent, paid, or overdue.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        status: { type: "string", enum: ["draft", "sent", "paid", "overdue"] },
      },
      required: ["invoice_id", "status"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateInvoiceStatus(
            requireString(args.invoice_id, "invoice_id"),
            requireString(args.status, "status") as InvoiceStatus
          )
        )
      ),
  },
  {
    name: "record_invoice_payment",
    description: "Record a manual (non-Stripe) payment against a sent invoice.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        account_id: { type: "string" },
      },
      required: ["invoice_id", "account_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await recordInvoicePayment(
            requireString(args.invoice_id, "invoice_id"),
            requireString(args.account_id, "account_id")
          )
        )
      ),
  },
  {
    name: "send_invoice_email",
    description: "Email an invoice PDF (or payment receipt if already paid).",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        to_email: { type: "string" },
        message: { type: "string" },
      },
      required: ["invoice_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await sendInvoiceEmail({
            invoiceId: requireString(args.invoice_id, "invoice_id"),
            toEmail: str(args, "to_email"),
            message: str(args, "message"),
          })
        )
      ),
  },
  {
    name: "list_transactions",
    description: "List bank/card transactions. Filter by type, account, or date range.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense", "transfer"] },
        account_id: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        query: { type: "string" },
        unreconciled_only: { type: "boolean" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        let query = supabase
          .from("transactions")
          .select(
            "id, type, amount, date, description, reference, account_id, transfer_account_id, category_id, customer_id, project_id, invoice_id, reconciled_at, accounts!transactions_account_id_fkey(id, name), categories(id, name), customers(id, name), invoices(id, invoice_number)"
          )
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(clampLimit(num(args, "limit")));
        const type = str(args, "type");
        if (type) query = query.eq("type", type);
        const accountId = str(args, "account_id");
        if (accountId) {
          query = query.or(
            `account_id.eq.${accountId},transfer_account_id.eq.${accountId}`
          );
        }
        const from = str(args, "from");
        if (from) query = query.gte("date", from);
        const to = str(args, "to");
        if (to) query = query.lte("date", to);
        if (bool(args, "unreconciled_only")) query = query.is("reconciled_at", null);
        const q = str(args, "query");
        if (q) query = query.ilike("description", ilike(q));
        const { data, error } = await query;
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "create_transaction",
    description: "Create an income, expense, or transfer. Amount is USD dollars.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense", "transfer"] },
        amount: { type: "number" },
        date: { type: "string" },
        description: { type: "string" },
        reference: { type: "string" },
        account_id: { type: "string" },
        transfer_account_id: { type: "string" },
        category_id: { type: "string" },
        customer_id: { type: "string" },
        project_id: { type: "string" },
        invoice_id: { type: "string" },
      },
      required: ["type", "amount", "account_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await createTransaction(
            formFrom(args, [
              "type",
              "amount",
              "date",
              "description",
              "reference",
              "account_id",
              "transfer_account_id",
              "category_id",
              "customer_id",
              "project_id",
              "invoice_id",
            ])
          )
        )
      ),
  },
  {
    name: "update_transaction",
    description:
      "Update a transaction. Category, description, date, reference, customer, project, and invoice can change even after reconciliation. Amount, account, and type require the transaction to be unreconciled — use set_transaction_reconciled to reopen first.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_id: { type: "string" },
        type: { type: "string", enum: ["income", "expense", "transfer"] },
        amount: { type: "number" },
        date: { type: "string" },
        description: { type: "string" },
        reference: { type: "string" },
        account_id: { type: "string" },
        transfer_account_id: { type: "string" },
        category_id: { type: "string" },
        customer_id: { type: "string" },
        project_id: { type: "string" },
        invoice_id: { type: "string" },
      },
      required: ["transaction_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateTransaction(
            requireString(args.transaction_id, "transaction_id"),
            formFrom(args, [
              "type",
              "amount",
              "date",
              "description",
              "reference",
              "account_id",
              "transfer_account_id",
              "category_id",
              "customer_id",
              "project_id",
              "invoice_id",
            ])
          )
        )
      ),
  },
  {
    name: "delete_transaction",
    description: "Delete an unreconciled transaction. Reopen first if it is reconciled.",
    inputSchema: {
      type: "object",
      properties: { transaction_id: { type: "string" } },
      required: ["transaction_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await deleteTransaction(requireString(args.transaction_id, "transaction_id"))
        )
      ),
  },
  {
    name: "set_transaction_reconciled",
    description:
      "Mark a transaction reconciled, or reopen it (reconciled=false) so amount, account, or type can be edited. Category, description, date, and similar fields do not require reopening.",
    inputSchema: {
      type: "object",
      properties: {
        transaction_id: { type: "string" },
        reconciled: { type: "boolean" },
      },
      required: ["transaction_id", "reconciled"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const reconciled = bool(args, "reconciled");
        if (reconciled === undefined) {
          throw new McpToolError("reconciled is required.");
        }
        return unwrapAction(
          await setTransactionReconciled(
            requireString(args.transaction_id, "transaction_id"),
            reconciled
          )
        );
      }),
  },
  {
    name: "list_accounts",
    description: "List bank, card, and Stripe accounts.",
    inputSchema: {
      type: "object",
      properties: { include_archived: { type: "boolean" } },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        let query = supabase.from("accounts").select("*").order("name");
        if (!bool(args, "include_archived")) query = query.eq("is_active", true);
        const { data, error } = await query;
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "create_account",
    description: "Create a checking, credit card, or Stripe clearing account.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["checking", "credit_card", "stripe"] },
        opening_balance: { type: "number" },
      },
      required: ["name", "type"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await createAccount(formFrom(args, ["name", "type", "opening_balance"]))
        )
      ),
  },
  {
    name: "set_account_active",
    description: "Archive or restore an account.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        is_active: { type: "boolean" },
      },
      required: ["account_id", "is_active"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await setAccountActive(
            requireString(args.account_id, "account_id"),
            Boolean(args.is_active)
          )
        )
      ),
  },
  {
    name: "list_categories",
    description: "List income and expense categories.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("type")
          .order("name");
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "create_category",
    description: "Create an income or expense category.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["income", "expense"] },
      },
      required: ["name", "type"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(await createCategory(formFrom(args, ["name", "type"])))
      ),
  },
  {
    name: "delete_category",
    description: "Delete a category.",
    inputSchema: {
      type: "object",
      properties: { category_id: { type: "string" } },
      required: ["category_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(await deleteCategory(requireString(args.category_id, "category_id")))
      ),
  },
  {
    name: "list_reconciliations",
    description: "List account reconciliations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) => asUser(userId, () => listReconciliations()),
  },
  {
    name: "get_reconciliation",
    description: "Get a reconciliation with candidate transactions and difference.",
    inputSchema: {
      type: "object",
      properties: { reconciliation_id: { type: "string" } },
      required: ["reconciliation_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const result = await getReconciliation(
          requireString(args.reconciliation_id, "reconciliation_id")
        );
        if (!result.ok) throw new McpToolError(result.error);
        return result;
      }),
  },
  {
    name: "start_reconciliation",
    description: "Start reconciling an account against a statement.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        statement_date: { type: "string" },
        statement_balance: { type: "number" },
      },
      required: ["account_id", "statement_date", "statement_balance"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await startReconciliation({
            accountId: requireString(args.account_id, "account_id"),
            statementDate: requireString(args.statement_date, "statement_date"),
            statementBalance: Number(args.statement_balance),
          })
        )
      ),
  },
  {
    name: "set_reconciliation_items",
    description: "Set which transactions are cleared on an open reconciliation.",
    inputSchema: {
      type: "object",
      properties: {
        reconciliation_id: { type: "string" },
        transaction_ids: { type: "array", items: { type: "string" } },
      },
      required: ["reconciliation_id", "transaction_ids"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () => {
        const ids = Array.isArray(args.transaction_ids)
          ? args.transaction_ids.filter((id): id is string => typeof id === "string")
          : [];
        return unwrapAction(
          await setReconciliationItems(
            requireString(args.reconciliation_id, "reconciliation_id"),
            ids
          )
        );
      }),
  },
  {
    name: "complete_reconciliation",
    description: "Complete an open reconciliation. Set force true to ignore a remaining difference.",
    inputSchema: {
      type: "object",
      properties: {
        reconciliation_id: { type: "string" },
        force: { type: "boolean" },
      },
      required: ["reconciliation_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await completeReconciliation(
            requireString(args.reconciliation_id, "reconciliation_id"),
            { force: bool(args, "force") === true }
          )
        )
      ),
  },
  {
    name: "void_reconciliation",
    description:
      "Void an open (in-progress) reconciliation. Completed reconciliations cannot be voided. To recategorize cleared transactions, call update_transaction. To change amount, account, or type, reopen the transaction with set_transaction_reconciled.",
    inputSchema: {
      type: "object",
      properties: { reconciliation_id: { type: "string" } },
      required: ["reconciliation_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await voidReconciliation(requireString(args.reconciliation_id, "reconciliation_id"))
        )
      ),
  },
  {
    name: "get_company_settings",
    description: "Get company name, address, invoice terms, and card fee settings.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("company_settings")
          .select(
            "id, name, address, email, phone, invoice_terms, stripe_fee_percent, stripe_fee_fixed, logo_path"
          )
          .limit(1)
          .maybeSingle();
        if (error) throw new McpToolError(error.message);
        return data;
      }),
  },
  {
    name: "update_company_settings",
    description: "Update company information used on invoices.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        invoice_terms: { type: "string" },
        stripe_fee_percent: { type: "number" },
        stripe_fee_fixed: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateCompanySettings(
            formFrom(args, [
              "name",
              "address",
              "email",
              "phone",
              "invoice_terms",
              "stripe_fee_percent",
              "stripe_fee_fixed",
            ])
          )
        )
      ),
  },
  {
    name: "list_users",
    description: "List workspace users and roles.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) =>
      asUser(userId, async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, created_at")
          .order("created_at");
        if (error) throw new McpToolError(error.message);
        return data ?? [];
      }),
  },
  {
    name: "invite_staff",
    description: "Invite a user by email. Owners only.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        full_name: { type: "string" },
        role: { type: "string", enum: ["owner", "staff", "client"] },
      },
      required: ["email"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await inviteStaffMember({
            email: requireString(args.email, "email"),
            fullName: str(args, "full_name"),
            role: (str(args, "role") as UserRole | undefined) ?? "staff",
          })
        )
      ),
  },
  {
    name: "update_user_role",
    description: "Change a user's role. Owners only.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        role: { type: "string", enum: ["owner", "staff", "client"] },
      },
      required: ["user_id", "role"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      asUser(userId, async () =>
        unwrapAction(
          await updateUserRole(
            requireString(args.user_id, "user_id"),
            requireString(args.role, "role") as UserRole
          )
        )
      ),
  },
];

export function listMcpToolDescriptors() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callMcpTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const tool = MCP_TOOLS.find((item) => item.name === name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    const result = await tool.handler(userId, args);
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool failed";
    return { ok: false, error: message };
  }
}
