import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysis } from "@/lib/inventory/store";

export function PageGate({ children }: { children: ReactNode }) {
  const { ready } = useAnalysis();
  if (!ready) {
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  return <>{children}</>;
}
