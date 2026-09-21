import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onAction: () => void };
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <PackageOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Button size="sm" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </div>
  );
}