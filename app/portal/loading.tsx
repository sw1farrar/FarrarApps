import { PageSkeleton } from "@/components/layout/page-skeleton";

export default function PortalLoading() {
  return <PageSkeleton cards={3} className="mx-auto w-full max-w-4xl" />;
}
