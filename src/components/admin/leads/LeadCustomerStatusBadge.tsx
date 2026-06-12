import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import { shouldPromoteLeadToCustomer } from "@/lib/crmLookup/leadCustomerLifecycleRules";
import type { LeadStatus } from "./constants";

interface Props {
  customerId?: string | null;
  email?: string | null;
  status: LeadStatus;
}

export function LeadCustomerStatusBadge({ customerId, email, status }: Props) {
  if (customerId) {
    const href = adminCustomerHrefPreferred(customerId, email);
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
          Lead prepojený na klienta
        </Badge>
        {href && (
          <Link to={href} className="text-[10px] text-primary hover:underline">
            Otvoriť klienta 360°
          </Link>
        )}
      </div>
    );
  }

  if (shouldPromoteLeadToCustomer(status)) {
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/25">
        Zrealizovaný lead — chýba prepojenie na klienta
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      Lead (predaj)
    </Badge>
  );
}
