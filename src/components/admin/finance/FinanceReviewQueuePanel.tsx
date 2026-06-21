import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  buildReviewQueue,
  type ReviewItemStatus,
  type ReviewItemType,
  type ReviewQueueItem,
} from "@/lib/finance/buildReviewQueue";
import { snoozeReviewItem, upsertReviewStatus } from "@/lib/finance/reviewGovernance";
import type { IssueDismissalRow } from "@/lib/finance/dismissals";
import type { CommissionRule, CommissionRuleOverride } from "@/lib/finance/commissionRules";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import type { SettlementDraft } from "@/lib/finance/types";
import type { FinanceReviewStatusRow } from "@/lib/finance/buildReviewQueue";

const TYPE_LABELS: Record<ReviewItemType, string> = {
  dismissed_issue: "Zamietnutý problém",
  commission_override: "Override provízie",
  hosting_commissionable: "Hosting — provízny",
  settlement_warning: "Upozornenie vyúčtovania",
};

type Filter = "pending" | "due_soon" | "overdue" | "reviewed" | "all";

const REVIEW_STATUS_LABELS: Record<ReviewItemStatus, string> = {
  pending: "Čaká",
  reviewed: "Skontrolované",
  still_valid: "Platí",
  reopened: "Znovu otvorené",
};

interface Props {
  dismissals: IssueDismissalRow[];
  overrides: CommissionRuleOverride[];
  hostingRecords: HostingRecordRow[];
  settlementDrafts: SettlementDraft[];
  reviewStatuses: FinanceReviewStatusRow[];
  rules: CommissionRule[];
  onSaved: () => void;
}

function dueBadge(item: ReviewQueueItem) {
  if (item.dueStatus === "overdue") {
    return <Badge variant="destructive" className="text-[10px]">Po termíne</Badge>;
  }
  if (item.dueStatus === "due_soon") {
    return <Badge variant="secondary" className="text-[10px] bg-amber-500/20">Blíži sa termín</Badge>;
  }
  if (item.dueStatus === "snoozed") {
    return <Badge variant="outline" className="text-[10px]">Odložené</Badge>;
  }
  return null;
}

export function FinanceReviewQueuePanel({
  dismissals,
  overrides,
  hostingRecords,
  settlementDrafts,
  reviewStatuses,
  rules,
  onSaved,
}: Props) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const queue = useMemo(
    () =>
      buildReviewQueue({
        dismissals,
        overrides,
        hostingRecords,
        settlementDrafts,
        reviewStatuses,
        rules,
      }),
    [dismissals, overrides, hostingRecords, settlementDrafts, reviewStatuses, rules],
  );

  const visible = useMemo(() => {
    if (filter === "pending") {
      return queue.filter(
        (q) =>
          (q.status === "pending" || q.status === "reopened") &&
          q.dueStatus !== "snoozed",
      );
    }
    if (filter === "due_soon") {
      return queue.filter((q) => q.dueStatus === "due_soon");
    }
    if (filter === "overdue") {
      return queue.filter((q) => q.dueStatus === "overdue");
    }
    if (filter === "reviewed") {
      return queue.filter((q) => q.status === "reviewed" || q.status === "still_valid");
    }
    return queue;
  }, [queue, filter]);

  const counts = useMemo(
    () => ({
      pending: queue.filter(
        (q) =>
          (q.status === "pending" || q.status === "reopened") &&
          q.dueStatus !== "snoozed",
      ).length,
      dueSoon: queue.filter((q) => q.dueStatus === "due_soon").length,
      overdue: queue.filter((q) => q.dueStatus === "overdue").length,
    }),
    [queue],
  );

  const setStatus = async (item: ReviewQueueItem, status: ReviewItemStatus) => {
    try {
      await upsertReviewStatus({
        itemKey: item.itemKey,
        itemType: item.itemType,
        status,
        reviewNote: noteDraft[item.itemKey] || undefined,
      });
      toast({ title: status === "reopened" ? "Znovu otvorené" : "Kontrola aktualizovaná" });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    }
  };

  const snooze = async (item: ReviewQueueItem) => {
    try {
      await snoozeReviewItem({ itemKey: item.itemKey, itemType: item.itemType, days: 7 });
      toast({ title: "Odložené na 7 dní" });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Fronta kontroly — iba metadáta. Čakajúce: {counts.pending}, blíži sa termín: {counts.dueSoon}, po termíne: {counts.overdue}.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", `Čakajúce (${counts.pending})`],
            ["due_soon", `Blíži sa (${counts.dueSoon})`],
            ["overdue", `Po termíne (${counts.overdue})`],
            ["reviewed", "Skontrolované"],
            ["all", "Všetky"],
          ] as const
        ).map(([f, label]) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {label}
          </Button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-xl">Prázdna fronta kontroly.</p>
      ) : (
        <div className="rounded-xl border overflow-x-auto table-dense max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Termín</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.slice(0, 100).map((item) => (
                <TableRow key={item.itemKey}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[item.itemType]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[140px] truncate">{item.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                    {item.customerLabel ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{item.detail}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {item.reviewDueAt ? item.reviewDueAt.slice(0, 10) : "—"}
                    <div className="mt-0.5">{dueBadge(item)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "pending" ? "destructive" : "secondary"} className="text-[10px]">
                      {REVIEW_STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Poznámka ku kontrole"
                      value={noteDraft[item.itemKey] ?? item.reviewNote ?? ""}
                      onChange={(e) => setNoteDraft({ ...noteDraft, [item.itemKey]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => void setStatus(item, "reviewed")}>
                        Skontrolované
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => void setStatus(item, "still_valid")}>
                        Stále platí
                      </Button>
                      {(item.status === "pending" || item.status === "reopened") && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => void snooze(item)}>
                          Odložiť 7 dní
                        </Button>
                      )}
                      {(item.status === "reviewed" || item.status === "still_valid") && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => void setStatus(item, "reopened")}>
                          Znovu otvoriť
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
