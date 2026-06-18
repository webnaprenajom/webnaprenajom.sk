import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import {
  MARKETING_CHANNELS,
  MARKETING_STATUSES,
  MARKETING_STATUS_COLORS,
  type MarketingRecord,
} from "@/components/admin/marketing/shared";
import { MarketingRecordEditDialog } from "@/components/admin/marketing/MarketingRecordEditDialog";
import { saveMarketingRecord } from "@/components/admin/marketing/marketingRecordSave";
import { ArrowLeft, ExternalLink, Loader2, Pencil } from "lucide-react";
import {
  CanonicalCustomerBadge,
  ClientLinkBadge,
  ConfirmedLinkBadge,
} from "@/components/admin/lookup/LinkStatusBadge";

type MarketingRecordDetail = MarketingRecord & {
  customers?: { id: string; email: string | null; display_name: string } | null;
};

export default function AdminMarketingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<MarketingRecordDetail | null>(null);
  const [lead, setLead] = useState<{ id: string; name: string; email: string | null } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketingRecord> | null>(null);
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    document.title = "Detail kampane | CRM";
    void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_records")
      .select("*, customers(id, email, display_name)")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Kampaň nenájdená", variant: "destructive" });
      navigate("/admin/marketing", { replace: true });
      return;
    }

    const row = data as MarketingRecordDetail;
    setRecord(row);
    setLead(null);

    if (row.lead_id) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("id,name,email")
        .eq("id", row.lead_id)
        .maybeSingle();
      if (leadRow) setLead(leadRow);
    }

    setLoading(false);
  };

  const openEdit = () => {
    if (!record) return;
    setCustomerFieldError(null);
    setEditing(record);
    setEditOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    const result = await saveMarketingRecord(editing, setCustomerFieldError);
    if (!result.ok) return;
    setCustomerFieldError(null);
    setEditOpen(false);
    setEditing(null);
    void load();
  };

  const statusCfg = useMemo(
    () => MARKETING_STATUSES.find((s) => s.value === record?.status),
    [record?.status],
  );

  const channelLabel = useMemo(
    () => MARKETING_CHANNELS.find((c) => c.value === record?.channel)?.label ?? record?.channel,
    [record?.channel],
  );

  if (loading || !record) {
    return (
      <AdminShell title="Marketing" subtitle="Načítavam…">
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  const customerHref = adminCustomerHrefPreferred(record.customer_id, record.customer_email);
  const clientLinked = !!record.lead_id;

  return (
    <AdminShell
      title={record.title}
      subtitle={record.client_name || "Bez klienta"}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="w-4 h-4 mr-1" /> Upraviť
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/marketing")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Späť
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border bg-card p-4 grid sm:grid-cols-2 gap-4 text-sm">
        <Field label="Kanál" value={channelLabel || "—"} />
        <Field label="Stav">
          <Badge variant="outline" className={statusCfg ? MARKETING_STATUS_COLORS[statusCfg.value] : ""}>
            {statusCfg?.label || record.status}
          </Badge>
        </Field>
        <Field label="Klient">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{record.client_name || record.customers?.display_name || "—"}</span>
            {record.customer_id ? <CanonicalCustomerBadge /> : <ClientLinkBadge linked={clientLinked} />}
          </div>
        </Field>
        <Field label="E-mail klienta">
          {customerHref ? (
            <Link to={customerHref} className="text-primary hover:underline">
              {record.customer_email || record.customers?.email || "Kanónický zákazník"}
            </Link>
          ) : (
            record.customer_email || "—"
          )}
        </Field>
        <Field label="URL">
          {record.url ? (
            <a
              href={record.url.startsWith("http") ? record.url : `https://${record.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {record.url} <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Prepojený lead">
          {lead ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/admin?lead=${lead.id}`} className="text-primary hover:underline">
                {lead.name}
                {lead.email ? ` · ${lead.email}` : ""}
              </Link>
              <ConfirmedLinkBadge />
            </div>
          ) : record.lead_id ? (
            <span className="text-muted-foreground text-xs">Lead ID: {record.lead_id}</span>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Vytvorené" value={new Date(record.created_at).toLocaleString("sk-SK")} />
        <Field label="Aktualizované" value={new Date(record.updated_at).toLocaleString("sk-SK")} />
        <div className="sm:col-span-2">
          <Field label="Poznámky">
            {record.notes ? (
              <div className="mt-1 rounded-lg bg-muted/40 p-3 whitespace-pre-wrap">{record.notes}</div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Field>
        </div>
      </section>

      <MarketingRecordEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={editing}
        setEditing={setEditing}
        onSave={save}
        customerFieldError={customerFieldError}
        onClearCustomerFieldError={() => setCustomerFieldError(null)}
      />
    </AdminShell>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div>{children ?? value}</div>
    </div>
  );
}
