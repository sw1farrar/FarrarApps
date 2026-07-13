export type UserRole = "owner" | "staff" | "client";
export type ThemePreference = "system" | "light" | "dark";
export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "delivered"
  | "archived";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type TransactionType = "income" | "expense";
export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "cash"
  | "other";
export type CategoryType = "income" | "expense";

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
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  portal_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  created_at: string;
};

export type Invoice = {
  id: string;
  customer_id: string;
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
  account_id: string;
  category_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  invoice_id: string | null;
  receipt_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  accounts?: Pick<Account, "id" | "name"> | null;
  categories?: Pick<Category, "id" | "name" | "type"> | null;
  customers?: Pick<Customer, "id" | "name"> | null;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};
