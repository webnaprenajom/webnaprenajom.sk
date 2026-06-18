import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, ExternalLink, FileText } from "lucide-react";
import { buildClientNameEmailMap, customerHrefByClientName } from "@/lib/adminNav";
import {
  type MarketingChannel,
  type MarketingRecord,
  type MarketingStatus,
  MARKETING_CHANNELS,
  MARKETING_STATUSES,
  MARKETING_STATUS_COLORS,
  emptyMarketingRecord,
} from "./shared";
import { MarketingRecordEditDialog } from "./MarketingRecordEditDialog";
import { saveMarketingRecord } from "./marketingRecordSave";

type StatusFilter = "all" | MarketingStatus;
type ChannelFilter = "all" | MarketingChannel;

export function MarketingView() {
  const [items, setItems] = useState<MarketingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketingRecord> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Marketing | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [recordsRes, leadsRes] = await Promise.all([
      supabase.from("marketing_records").select("*").order("updated_at", { ascending: false }),
      supabase.from("leads").select("name,email"),
    ]);
    if (recordsRes.error) {
      toast({ title: "Chyba", description: recordsRes.error.message, variant: "destructive" });
    } else {
      // TODO post-release: pridať assigned_to stĺpec + filterMarketingForUser
      // Option B (Batch 4c): administrator vidí všetky marketing záznamy — marketing_records nemá ownership stĺpce.
      setItems((recordsRes.data || []) as MarketingRecord[]);
    }
    if (!leadsRes.error && leadsRes.data) {
      setClientEmailMap(buildClientNameEmailMap(leadsRes.data));
    }
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

  const save = async () => {
    if (!editing) return;
    const result = await saveMarketingRecord(editing, setCustomerFieldError);
    if (!result.ok) return;
    setCustomerFieldError(null);
    setOpen(false);
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať tento marketingový záznam?")) return;
    const { error } = await supabase.from("marketing_records").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Zmazané" });
      void load();
    }
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      return true;
    });
  }, [items, statusFilter, channelFilter]);

  const channelLabel = (channel: string) =>
    MARKETING_CHANNELS.find((c) => c.value === channel)?.label ?? channel;

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

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl space-y-4">
            <p>Žiadne marketingové záznamy</p>
            {items.length === 0 && (
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" /> Pridať kampaň
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const status = MARKETING_STATUSES.find((s) => s.value === item.status);
              return (
                <div
                  key={item.id}
                  className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/marketing/${item.id}`}
                        className="font-semibold truncate block hover:text-primary hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.client_name && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>
                          {customerHrefByClientName(item.client_name, clientEmailMap) && (
                            <Link
                              to={customerHrefByClientName(item.client_name, clientEmailMap)!}
                              className="text-[10px] text-primary hover:underline"
                            >
                              Klient 360°
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={status ? MARKETING_STATUS_COLORS[status.value] : ""}
                      >
                        {status?.label ?? item.status}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {channelLabel(item.channel)}
                      </Badge>
                    </div>
                  </div>

                  {item.url && (
                    <div className="flex items-center gap-2 text-sm">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {item.url}
                      </a>
                    </div>
                  )}

                  {item.notes && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        Poznámka
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                        {item.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.updated_at).toLocaleDateString("sk-SK")}
                    </span>
                    <div className="flex gap-1">
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
                  </div>
                </div>
              );
            })}
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
    </AdminShell>
  );
}
