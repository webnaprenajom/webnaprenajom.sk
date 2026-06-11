import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ClientPicker, type ClientPickerValue } from "@/components/admin/lookup/ClientPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  fetchCommunicationDiagnostics,
  type CommunicationDiagnostics,
  type WebhookIncidentType,
} from "@/lib/communication/diagnostics";
import {
  reconcileCommunicationEventsByEmail,
  reconcileCommunicationEventsToCustomer,
} from "@/lib/communication/reconcile";
import { adminCustomerHref, adminCustomerHrefById } from "@/lib/adminNav";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
  Unlink,
} from "lucide-react";

const INCIDENT_LABELS: Record<WebhookIncidentType, string> = {
  verify_failed: "Overenie podpisu zlyhalo",
  fetch_failed: "Receiving API zlyhalo",
  malformed: "Neplatný payload",
  insert_failed: "Uloženie zlyhalo",
  deduped_inbound: "Duplicitný retry (dedup)",
};

const INCIDENT_TONE: Record<WebhookIncidentType, string> = {
  verify_failed: "bg-red-500/15 text-red-600 border-red-500/30",
  fetch_failed: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  malformed: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  insert_failed: "bg-red-500/15 text-red-600 border-red-500/30",
  deduped_inbound: "bg-muted text-muted-foreground border-border",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Mail;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`w-4 h-4 ${tone ?? ""}`} />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const AdminCommunicationOps = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommunicationDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reconcileTarget, setReconcileTarget] = useState<ClientPickerValue>({
    client_name: "",
    customer_email: null,
    lead_id: null,
    customer_id: null,
  });
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchCommunicationDiagnostics(30);
    setData(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!data) return;
    if (checked) setSelectedIds(new Set(data.unlinkedEvents.map((e) => e.id)));
    else setSelectedIds(new Set());
  };

  const handleReconcileSelected = async () => {
    if (!reconcileTarget.customer_id) {
      toast({ title: "Vyberte zákazníka", variant: "destructive" });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: "Vyberte aspoň jednu udalosť", variant: "destructive" });
      return;
    }

    setReconciling(true);
    const result = await reconcileCommunicationEventsToCustomer(
      [...selectedIds],
      reconcileTarget.customer_id,
    );
    setReconciling(false);

    if (!result.ok) {
      toast({ title: "Prepojenie zlyhalo", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: `Prepojené ${result.updated} udalostí` });
    setSelectedIds(new Set());
    void load();
  };

  const handleReconcileByEmail = async (email: string) => {
    if (!reconcileTarget.customer_id) {
      toast({ title: "Vyberte zákazníka", variant: "destructive" });
      return;
    }

    setReconciling(true);
    const result = await reconcileCommunicationEventsByEmail(reconcileTarget.customer_id, email);
    setReconciling(false);

    if (!result.ok) {
      toast({ title: "Bulk prepojenie zlyhalo", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: `Prepojené ${result.updated} udalostí pre ${email}` });
    setSelectedIds(new Set());
    void load();
  };

  return (
    <AdminLayout
      title="Komunikácia — operácie"
      subtitle="Diagnostika inbound webhookov, neprepojené e-maily a manuálna reconciliácia (Batch G.5)"
      actions={
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Obnoviť
        </Button>
      }
    >
      {loading && !data ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-4 flex gap-2 text-sm text-destructive">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Prichádzajúce" value={data.inboundTotal} icon={Inbox} />
            <StatCard label="Odchádzajúce" value={data.outboundTotal} icon={Mail} />
            <StatCard
              label="Neprepojené inbound"
              value={data.unlinkedInbound}
              icon={Unlink}
              tone="text-amber-600"
            />
            <StatCard label="Inbound vo vlákne" value={data.threadAwareInbound} icon={Mail} />
          </div>

          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Webhook incidenty
            </h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(INCIDENT_LABELS) as WebhookIncidentType[]).map((type) => (
                <Badge key={type} variant="outline" className={INCIDENT_TONE[type]}>
                  {INCIDENT_LABELS[type]}: {data.incidentCounts[type]}
                </Badge>
              ))}
            </div>
            {data.recentIncidents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Žiadne incidenty v poslednom okne.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Čas</TableHead>
                    <TableHead className="text-xs">Typ</TableHead>
                    <TableHead className="text-xs">Odosielateľ</TableHead>
                    <TableHead className="text-xs">Súhrn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentIncidents.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell className="text-[11px] whitespace-nowrap">
                        {new Date(inc.occurred_at).toLocaleString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${INCIDENT_TONE[inc.incident_type]}`}>
                          {INCIDENT_LABELS[inc.incident_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">
                        {inc.sender_email ?? "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground max-w-md truncate">
                        {inc.summary}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Neprepojené prichádzajúce e-maily</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Udalosti bez customer_id — vyberte zákazníka a prepojte bez zmeny ID záznamu.
                </p>
              </div>
              <div className="w-full sm:max-w-sm space-y-2">
                <ClientPicker
                  clientName={reconcileTarget.client_name}
                  customerEmail={reconcileTarget.customer_email}
                  customerId={reconcileTarget.customer_id}
                  leadId={reconcileTarget.lead_id}
                  onChange={setReconcileTarget}
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={reconciling || selectedIds.size === 0 || !reconcileTarget.customer_id}
                  onClick={() => void handleReconcileSelected()}
                >
                  {reconciling ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : null}
                  Prepojiť vybrané ({selectedIds.size})
                </Button>
              </div>
            </div>

            {data.unlinkedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Všetky inbound udalosti sú prepojené.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={
                          data.unlinkedEvents.length > 0 &&
                          selectedIds.size === data.unlinkedEvents.length
                        }
                        onCheckedChange={(v) => toggleSelectAll(!!v)}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Čas</TableHead>
                    <TableHead className="text-xs">Predmet</TableHead>
                    <TableHead className="text-xs">Odosielateľ</TableHead>
                    <TableHead className="text-xs">Vlákno</TableHead>
                    <TableHead className="text-xs">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unlinkedEvents.map((ev) => {
                    const email = ev.sender_email ?? ev.customer_email;
                    const emailHref = email ? adminCustomerHref(email) : null;
                    return (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(ev.id)}
                            onCheckedChange={(v) => toggleSelect(ev.id, !!v)}
                          />
                        </TableCell>
                        <TableCell className="text-[11px] whitespace-nowrap">
                          {new Date(ev.occurred_at).toLocaleString("sk-SK")}
                        </TableCell>
                        <TableCell className="text-[11px] font-medium max-w-[200px] truncate">
                          {ev.title}
                        </TableCell>
                        <TableCell className="text-[11px] font-mono">{email ?? "—"}</TableCell>
                        <TableCell className="text-[11px]">
                          {ev.thread_id ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {ev.thread_id.slice(0, 24)}
                              {ev.thread_id.length > 24 ? "…" : ""}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] space-x-1">
                          {emailHref && (
                            <Link to={emailHref}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs">
                                360°
                              </Button>
                            </Link>
                          )}
                          {email && reconcileTarget.customer_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={reconciling}
                              onClick={() => void handleReconcileByEmail(email)}
                            >
                              Všetky pre email
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Reconciliácia — postup</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Vytvorte alebo nájdite zákazníka v Klienti (canonical customers).</li>
              <li>Prepojte neznáme inbound udalosti cez vybraného zákazníka — ID udalostí zostáva.</li>
              <li>Overte timeline na{" "}
                {reconcileTarget.customer_id ? (
                  <Link
                    to={adminCustomerHrefById(reconcileTarget.customer_id)}
                    className="text-primary underline"
                  >
                    360° zákazníka
                  </Link>
                ) : (
                  "360° zákazníka"
                )}
                .
              </li>
            </ol>
            <p>
              Logy neobsahujú raw webhook payload ani API kľúče. Duplicitné Resend retry sa
              zapisujú ako incident typu deduped_inbound.
            </p>
          </section>
        </div>
      ) : null}
    </AdminLayout>
  );
};

export default AdminCommunicationOps;
