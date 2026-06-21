import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CanonicalCustomerBadge, HeuristicDataBadge } from "@/components/admin/lookup/LinkStatusBadge";
import type { QuickCreateKind } from "@/components/admin/customerWorkbench/CustomerQuickCreateDialogs";
import {
  computeCustomerMrr,
  computeCustomerRiskBadges,
  computeCustomerType,
  customerTypeLabel,
} from "@/lib/customerWorkbench/summary";
import type {
  CustomerFinanceSummary,
  CustomerWorkbenchContext,
  CustomerWorkbenchData,
  WorkbenchSummary,
  WorkbenchTabId,
} from "@/lib/customerWorkbench/types";
import {
  Building2,
  Calendar,
  Copy,
  Globe,
  ListTodo,
  Mail,
  MessageSquarePlus,
  MoreHorizontal,
  Phone,
  Server,
  User,
  Wallet,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CustomerEditButton } from "@/components/admin/customerHub/CustomerEditDialog";
import { metaStringFromCustomer } from "@/lib/crmLookup/customerProfile";

interface Props {
  data: CustomerWorkbenchData;
  summary: WorkbenchSummary;
  finance: CustomerFinanceSummary;
  ctx: CustomerWorkbenchContext;
  onOpenTab: (tab: WorkbenchTabId) => void;
  onQuickCreate: (kind: QuickCreateKind) => void;
  onOpenCommunication: () => void;
  canDeleteCustomer?: boolean;
  onDeleteCustomer?: () => void;
  onCustomerSaved?: () => void;
}

function getCustomerCompany(metadata: unknown): string | null {
  const company = metaStringFromCustomer(metadata, "company");
  return company || null;
}

export function CustomerHubHeader({
  data,
  summary,
  finance,
  ctx,
  onOpenTab,
  onQuickCreate,
  onOpenCommunication,
  canDeleteCustomer,
  onDeleteCustomer,
  onCustomerSaved,
}: Props) {
  const primaryLead = data.leads[0];
  const company = getCustomerCompany(data.canonicalCustomer?.metadata);
  const customerType = computeCustomerType(data);
  const mrr = computeCustomerMrr(data);
  const riskBadges = computeCustomerRiskBadges(data, summary, finance);

  const formatLastComm = summary.lastCommunicationAt
    ? new Date(summary.lastCommunicationAt).toLocaleDateString("sk-SK")
    : "—";

  const copyCustomerInfo = async () => {
    const lines = [
      summary.displayName,
      summary.emailKey ? `E-mail: ${summary.emailKey}` : null,
      summary.phone ? `Tel: ${summary.phone}` : null,
      ctx.resolvedCustomerId ? `Customer ID: ${ctx.resolvedCustomerId}` : null,
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Skopírované do schránky" });
  };

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Klientsky cockpit
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{summary.displayName}</h1>
              {data.viewMode === "id" && data.canonicalCustomer ? (
                <CanonicalCustomerBadge />
              ) : (
                <HeuristicDataBadge />
              )}
              <Badge className={`text-[10px] ${summary.lifecycle.tone}`} variant="outline">
                {summary.lifecycle.label}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {customerTypeLabel(customerType)}
              </Badge>
              {mrr > 0 && (
                <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-700 dark:text-green-400">
                  MRR {mrr.toLocaleString("sk-SK")} €
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              {summary.emailKey && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {summary.emailKey}
                </span>
              )}
              {summary.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {summary.phone}
                </span>
              )}
              {company && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {company}
                </span>
              )}
              {primaryLead?.source && (
                <span className="flex items-center gap-1">
                  Zdroj: {primaryLead.source}
                </span>
              )}
              {primaryLead?.assigned_to && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {primaryLead.assigned_to}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Posledná komunikácia: {formatLastComm}
              </span>
            </div>
            {ctx.resolvedCustomerId && (
              <Link
                to={`/admin/customers/${ctx.resolvedCustomerId}`}
                className="text-[10px] text-primary hover:underline"
              >
                Canonical customer · {ctx.resolvedCustomerId.slice(0, 8)}…
              </Link>
            )}
          </div>
          {primaryLead && (
            <Button size="sm" variant="default" asChild>
              <Link to={`/admin?lead=${primaryLead.id}`}>Hlavný lead</Link>
            </Button>
          )}
          {data.canonicalCustomer && onCustomerSaved && (
            <CustomerEditButton
              customer={data.canonicalCustomer}
              fallbackPhone={summary.phone}
              onSaved={onCustomerSaved}
            />
          )}
        </div>

        {riskBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {riskBadges.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => b.tab && onOpenTab(b.tab)}
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className={`text-[10px] cursor-pointer hover:opacity-80 ${
                    b.tone === "danger"
                      ? "border-red-500/40 text-red-700 dark:text-red-400"
                      : b.tone === "warning"
                        ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                        : ""
                  }`}
                >
                  {b.label}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/80 px-2 py-2 sm:px-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin items-center">
          <Button size="sm" variant="secondary" className="shrink-0 h-8 text-xs" onClick={onOpenCommunication}>
            <MessageSquarePlus className="w-3.5 h-3.5 mr-1" /> Poznámka
          </Button>
          <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => onQuickCreate("task")}>
            <ListTodo className="w-3.5 h-3.5 mr-1" /> Úloha
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">
                <MoreHorizontal className="w-3.5 h-3.5 mr-1" /> Vytvoriť
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onQuickCreate("project")}>
                <Globe className="w-3.5 h-3.5 mr-2" /> Projekt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickCreate("rental")}>
                <Globe className="w-3.5 h-3.5 mr-2" /> Prenájom
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickCreate("hosting")}>
                <Server className="w-3.5 h-3.5 mr-2" /> Hosting
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickCreate("commission")}>
                <Wallet className="w-3.5 h-3.5 mr-2" /> Provízia
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="shrink-0 h-8 text-xs" onClick={() => void copyCustomerInfo()}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Kopírovať
          </Button>
          {canDeleteCustomer && onDeleteCustomer && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-8 text-xs text-destructive border-destructive/40 hover:bg-destructive/5"
              onClick={onDeleteCustomer}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Zmazať klienta
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
