import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";

type Props = {
  user: CrmManagedUser;
  duplicateNames?: Set<string>;
  compact?: boolean;
};

export function CrmUserIdentity({ user, duplicateNames, compact = false }: Props) {
  const isDuplicate = duplicateNames?.has(user.displayName.trim().toLowerCase()) ?? false;

  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className={`font-medium truncate ${compact ? "text-xs" : "text-sm"}`}>
        {user.displayName}
        {isDuplicate && user.email && (
          <span className="text-muted-foreground font-normal"> · {user.email}</span>
        )}
      </p>
      {user.email && (
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      )}
      {!user.email && (
        <p className="text-xs text-amber-600">E-mail nie je v adresári — overte účet v Auth</p>
      )}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground mt-0.5">
          <ChevronDown className="w-3 h-3" />
          Technické detaily
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="text-[10px] font-mono text-muted-foreground break-all pt-1">{user.userId}</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
