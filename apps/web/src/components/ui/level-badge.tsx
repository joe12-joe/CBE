import type { CompetencyLevel } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LevelBadge({ level, className }: { level: CompetencyLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        levelColor(level),
        className
      )}
      title={levelLabel(level)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
    </span>
  );
}

export function LevelPill({ level, className }: { level: CompetencyLevel | null; className?: string }) {
  if (!level) {
    return (
      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground", className)}>
        —
      </span>
    );
  }
  return <LevelBadge level={level} className={className} />;
}