import { AlertCircle, Inbox, UserCog } from "lucide-react";
import type { ScopedEmptyReason } from "@/lib/rbac/permissions";

const ICON: Record<ScopedEmptyReason, typeof Inbox> = {
  no_data: Inbox,
  missing_profile: UserCog,
  scoped_empty: Inbox,
};

const TONE: Record<ScopedEmptyReason, string> = {
  no_data: "border-border bg-muted/20",
  missing_profile: "border-amber-500/40 bg-amber-500/5",
  scoped_empty: "border-border bg-muted/20",
};

interface Props {
  reason: ScopedEmptyReason;
  title: string;
  body: string;
  action?: React.ReactNode;
}

export function ScopedEmptyState({ reason, title, body, action }: Props) {
  const Icon = ICON[reason];
  return (
    <div className={`rounded-xl border p-6 text-center space-y-3 ${TONE[reason]}`}>
      <Icon className={`w-8 h-8 mx-auto ${reason === "missing_profile" ? "text-amber-600" : "text-muted-foreground"}`} />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{body}</p>
      </div>
      {action}
      {reason === "missing_profile" && (
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" /> Kontaktujte správcu CRM
        </p>
      )}
    </div>
  );
}
