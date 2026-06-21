import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { matchesSearchQuery } from "@/lib/searchMatch";
import { formatAgreedPrice } from "@/components/admin/AgreedPriceField";
import { PaymentCompletenessBadge } from "@/components/admin/PaymentCompletenessBadge";
import {
  buildConfirmedPaymentTotalsBySource,
  confirmedPaidForEntity,
} from "@/lib/finance/paymentCompleteness";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, ExternalLink, FileText, Search } from "lucide-react";
import { buildClientNameEmailMap, customerHrefByClientName } from "@/lib/adminNav";
import {
  type MarketingChannel,
  type MarketingRecord,
  type MarketingStatus,
  MARKETING_CHANNELS,
  MARKETING_STATUSES,
  MARKETING_STATUS_COLORS,
  MARKETING_LIST_SELECT,
  emptyMarketingRecord,
} from "./shared";
import { MarketingRecordEditDialog } from "./MarketingRecordEditDialog";
import { saveMarketingRecord } from "./marketingRecordSave";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";

type StatusFilter = "all" | MarketingStatus;
type ChannelFilter = "all" | MarketingChannel;

export function MarketingView() {
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({ onSuccess: () => void load() });
  const [items, setItems] = useState<MarketingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketingRecord> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);
  const [confirmedBySource, setConfirmedBySource] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    document.title = "Marketing | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [recordsRes, leadsRes, paysRes] = await Promise.all([
      supabase.from("marketing_records").select(MARKETING_LIST_SELECT).order("updated_at", { ascending: false }),
      supabase.from("leads").select("name,email"),
      supabase
        .from("payment_records")
        .select("source_table,source_id,amount,truth_level")
        .eq("source_table", "marketing_records"),
    ]);
    if (recordsRes.error) {
      toast({ title: "Chyba", description: recordsRes.error.message, variant: "destructive" });
    } else {
      // Registry-backed assigned_to on marketing_records (migration 20260627120000).
      setItems((recordsRes.data || []) as MarketingRecord[]);
    }
    if (!leadsRes.error && leadsRes.data) {
      setClientEmailMap(buildClientNameEmailMap(leadsRes.data));
    }
    setConfirmedBySource(buildConfirmedPaymentTotalsBySource(paysRes.data || []));
    setLoading(false);
  };

  const openNew = () => {
    setCustomerFieldError(null);
    setEditing({ ...emptyMarketingRecord, client_name: "" });
    setOpen(true);
  };

  const openEdit = (item: MarketingRecord) => {
    setCustomerFieldError(null);
    setEditing(item);
    setOpen(true);
  };

  const save = async (): Promise<boolean> => {
    if (!editing) return false;
    const result = await saveMarketingRecord(editing, setCustomerFieldError);
    if (!result.ok) return false;
    setCustomerFieldError(null);
    setOpen(false);
    setEditing(null);
    void load();
    return true;
  };

  const remove = (id: string) => {
    const row = items.find((i) => i.id === id);
    void requestDelete({
      entityType: "marketing",
      entityId: id,
      entityLabel: row?.title,
    });
  };

  const channelLabel = (channel: string) =>
    MARKETING_CHANNELS.find((c) => c.value === channel)?.label ?? channel;

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      if (!searchQuery.trim()) return true;
      const statusLabel = MARKETING_STATUSES.find((s) => s.value === item.status)?.label;
      const channel =
        MARKETING_CHANNELS.find((c) => c.value === item.channel)?.label ?? item.channel;
      return matchesSearchQuery(
        searchQuery,
        item.title,
        item.client_name,
        item.url,
        item.notes,
        statusLabel,
        channel,
        item.agreed_fee != null ? String(item.agreed_fee) : null,
      );
    });
  }, [items, statusFilter, channelFilter, searchQuery]);

  return (
    <AdminShell
      title="Marketing"
      subtitle="Kampane a marketingové služby — kanál, stav, klient"
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Pridať kampaň
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Stav:</span>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            Všetko ({items.length})
          </Button>
          {MARKETING_STATUSES.map((s) => {
            const count = items.filter((i) => i.status === s.value).length;
            return (
              <Button
                key={s.value}
                size="sm"
                variant={statusFilter === s.value ? "default" : "outline"}
                onClick={() => setStatusFilter(s.value)}
              >
                {s.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Kanál:</span>
          <Button
            size="sm"
            variant={channelFilter === "all" ? "default" : "outline"}
            onClick={() => setChannelFilter("all")}
          >
            Všetky
          </Button>
          {MARKETING_CHANNELS.map((c) => {
            const count = items.filter((i) => i.channel === c.value).length;
            return (
              <Button
                key={c.value}
                size="sm"
                variant={channelFilter === c.value ? "default" : "outline"}
                onClick={() => setChannelFilter(c.value)}
              >
                {c.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Hľadať kampaň, klienta, kanál, stav…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl space-y-4">
            <p>
              {items.length === 0
                ? "Žiadne marketingové záznamy"
                : "Žiadna zhoda pre zadané filtre alebo vyhľadávanie."}
            </p>
            {items.length === 0 && (
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" /> Pridať kampaň
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kampaň</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Realizátor</TableHead>
                  <TableHead>Kanál</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead className="text-right">Dohodnutá cena</TableHead>
                  <TableHead>Úhrada</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Aktualizované</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const status = MARKETING_STATUSES.find((s) => s.value === item.status);
                  const customerHref = item.client_name
                    ? customerHrefByClientName(item.client_name, clientEmailMap)
                    : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">
                        <Link
                          to={`/admin/marketing/${item.id}`}
                          className="text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                        {item.notes && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5 flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5 shrink-0" />
                            {item.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.client_name ? (
                          <>
                            <span className="truncate block max-w-[180px]">{item.client_name}</span>
                            {customerHref && (
                              <Link
                                to={customerHref}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Klient 360°
                              </Link>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.assigned_to || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {channelLabel(item.channel)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={status ? MARKETING_STATUS_COLORS[status.value] : ""}
                        >
                          {status?.label ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">
                        {formatAgreedPrice(item.agreed_fee)}
                      </TableCell>
                      <TableCell>
                        <PaymentCompletenessBadge
                          compact
                          agreedPrice={item.agreed_fee}
                          confirmedPaid={confirmedPaidForEntity(
                            confirmedBySource,
                            "marketing_records",
                            item.id,
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-xs max-w-[160px]">
                        {item.url ? (
                          <a
                            href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block"
                          >
                            <ExternalLink className="w-3 h-3 inline mr-1 shrink-0" />
                            {item.url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.updated_at).toLocaleDateString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <Link to={`/admin/marketing/${item.id}`}>Detail</Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => void remove(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <MarketingRecordEditDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        setEditing={setEditing}
        onSave={save}
        customerFieldError={customerFieldError}
        onClearCustomerFieldError={() => setCustomerFieldError(null)}
      />
      <DestructiveModal {...modalProps} />
    </AdminShell>
  );
}
