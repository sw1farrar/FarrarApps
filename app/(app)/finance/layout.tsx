import { FinanceNav } from "@/components/layout/finance-nav";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <FinanceNav />
      {children}
    </div>
  );
}
