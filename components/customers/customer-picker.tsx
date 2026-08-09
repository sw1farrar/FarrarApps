"use client";

import * as React from "react";
import type { Customer } from "@/lib/types/database";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { EntityCombobox } from "@/components/ui/entity-combobox";

export function CustomerPicker({
  name = "customer_id",
  value,
  onValueChange,
  customers,
  onCustomersChange,
  required = false,
  allowNone = false,
  placeholder = "Select customer",
}: {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  customers: Pick<Customer, "id" | "name" | "company" | "email">[];
  onCustomersChange?: (
    customers: Pick<Customer, "id" | "name" | "company" | "email">[]
  ) => void;
  required?: boolean;
  allowNone?: boolean;
  placeholder?: string;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultName, setDefaultName] = React.useState("");

  const options = customers.map((customer) => ({
    id: customer.id,
    label: customer.company
      ? `${customer.name} · ${customer.company}`
      : customer.name,
    keywords: [customer.name, customer.company, customer.email]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <>
      <EntityCombobox
        name={name}
        value={value}
        onValueChange={onValueChange}
        options={options}
        required={required}
        allowNone={allowNone}
        noneLabel="None"
        placeholder={placeholder}
        searchPlaceholder="Search customers…"
        emptyLabel="No customers match"
        createLabel="Add customer"
        onCreate={(query) => {
          setDefaultName(query);
          setCreateOpen(true);
        }}
      />
      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultName={defaultName}
        redirectOnCreate={false}
        onCreated={(created) => {
          onCustomersChange?.([
            ...customers.filter((c) => c.id !== created.id),
            { id: created.id, name: created.name, company: null, email: null },
          ]);
          onValueChange(created.id);
        }}
      />
    </>
  );
}
