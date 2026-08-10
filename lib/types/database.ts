export type UserRole = "owner" | "staff" | "client";
export type ThemePreference = "system" | "light" | "dark";
export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "delivered"
  | "archived";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type TransactionType = "income" | "expense" | "transfer";
export type AccountType = "checking" | "credit_card" | "stripe";
export type CategoryType = "income" | "expense";
export type ReconciliationStatus = "in_progress" | "completed" | "void";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  theme_preference: ThemePreference;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanySettings = {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  logo_path: string | null;
  invoice_terms: string | null;
  /** Card fee percent points for pass-through (e.g. 2.9 = 2.9%) */
  stripe_fee_percent?: number | null;
  /** Fixed card fee in major units (e.g. 0.30 USD) */
  stripe_fee_fixed?: number | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  portal_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerMemberRole = "company_admin" | "member";

export type CustomerMember = {
  id: string;
  customer_id: string;
  user_id: string;
  role: CustomerMemberRole;
  invited_by: string | null;
  created_at: string;
  profiles?: Pick<Profile, "id" | "email" | "full_name"> | null;
};

export type ProjectThread = {
  id: string;
  project_id: string;
  title: string;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
};

export type ProjectMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
  profiles?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type ProjectThreadRead = {
  thread_id: string;
  user_id: string;
  last_read_at: string;
};

export type Project = {
  id: string;
  customer_id: string;
  name: string;
  scope: string | null;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: Pick<Customer, "id" | "name" | "email"> | null;
};

export type ProjectFile = {
  id: string;
  project_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Reconciliation = {
  id: string;
  account_id: string;
  statement_date: string;
  statement_balance: number;
  status: ReconciliationStatus;
  started_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  accounts?: Pick<Account, "id" | "name" | "type"> | null;
};

export type StripeInvoicePayment = {
  id: string;
  invoice_id: string;
  customer_id: string;
  checkout_session_id: string | null;
  payment_intent_id: string | null;
  /** Invoice principal applied (income amount) */
  amount: number;
  /** Total charged to customer (Checkout amount_total) */
  charge_amount?: number | null;
  /** Card processing fee line (charge − invoice) */
  fee_amount?: number | null;
  currency: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  created_at: string;
};

export type Invoice = {
  id: string;
  /** Null on incomplete draft shells; required before send/pay. */
  customer_id: string | null;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  notes: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: Pick<Customer, "id" | "name" | "email" | "company"> | null;
  projects?: Pick<Project, "id" | "name"> | null;
};

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  description: string;
  /** Optional work/service date; omitted from display when null/undefined. */
  service_date?: string | null;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string | null;
  reference: string | null;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  invoice_id: string | null;
  receipt_path: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  accounts?: Pick<Account, "id" | "name"> | null;
  transfer_accounts?: Pick<Account, "id" | "name"> | null;
  categories?: Pick<Category, "id" | "name" | "type"> | null;
  customers?: Pick<Customer, "id" | "name"> | null;
  invoices?: Pick<Invoice, "id" | "invoice_number"> | null;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  profiles?: Pick<Profile, "email" | "full_name"> | null;
};

export type SavedView = {
  id: string;
  entity: string;
  name: string;
  filters: Record<string, string>;
  created_by: string | null;
  created_at: string;
};

export type TrustedDevice = {
  id: string;
  user_id: string;
  device_token: string;
  user_agent: string | null;
  last_used_at: string;
  created_at: string;
};
