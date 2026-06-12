import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntityCommissionsPanel } from "@/components/admin/EntityCommissionsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import {
  ConfirmedLinkBadge,
  EstimatedLinkBadge,
  StandaloneEntityBadge,
} from "@/components/admin/lookup/LinkStatusBadge";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { isValidEntityId } from "@/lib/crmLookup/resolveFormCustomerLink";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";

export default function AdminHostingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<HostingRecordRow | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [linkedRental, setLinkedRental] = useState<{ id: string; name: string; url: string | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [estimatedProjects, setEstimatedProjects] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!id) return;
    document.title = "Detail hostingu | CRM";
    void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);

    if (!isValidEntityId(id)) {
      setLoadError("Neplatné ID hostingu v adrese. Vráťte sa do zoznamu a otvorte záznam znova.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("hosting_records").select("*").eq("id", id).maybeSingle();
    adminDebugLog("hostingDetail", "fetch", { id, found: !!data, error: error?.message });

    if (error) {
      setLoadError(`Hosting sa nepodarilo načítať: ${error.message}`);
      setLoading(false);
      return;
    }
    if (!data) {
      setLoadError(
        "Hosting záznam neexistuje alebo k nemu nemáte prístup. Ak ste práve vytvorili záznam, obnovte zoznam a skúste znova.",
      );
      setLoading(false);
      return;
    }
    const row = data as HostingRecordRow;
    setRecord(row);

    const [payRes, rentalRes, projectRes] = await Promise.all([
      supabase
        .from("payment_records")
        .select("*")
        .eq("source_table", "hosting_records")
        .eq("source_id", id)
        .order("paid_at", { ascending: false }),
      row.rental_website_id
        ? (supabase as any)
            .from("rental_websites")
            .select("id,name,url")
            .eq("id", row.rental_website_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      row.customer_email
        ? supabase
            .from("project_notes")
            .select("id,title")
            .ilike("customer_email", normalizeEmail(row.customer_email) || row.customer_email)
        : Promise.resolve({ data: [] }),
    ]);

    setPayments(payRes.data || []);
    if (rentalRes.data) setLinkedRental(rentalRes.data);
    setEstimatedProjects(projectRes.data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <AdminShell title="Hosting" subtitle="Načítavam…">
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  if (loadError || !record) {
    return (
      <AdminShell
        title="Hosting"
        subtitle="Záznam sa nepodarilo načítať"
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/hosting")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Späť na zoznam
          </Button>
        }
      >
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-lg space-y-3">
          <div className="flex gap-2 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{loadError ?? "Neznáma chyba"}</p>
          </div>
          <Button onClick={() => void load()} variant="outline" size="sm">
            Skúsiť znova
          </Button>
        </div>
      </AdminShell>
    );
  }

  const label = record.client_name || record.customer_email || record.provider || "Hosting";
  const isStandalone = !record.rental_website_id;

  return (
    <AdminShell
      title={label}
      subtitle={record.provider || "Hosting záznam"}
      actions={
        <Button size="sm" variant="outline" onClick={() => navigate("/admin/hosting")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Späť
        </Button>
      }
    >
      <Tabs defaultValue="prehlad" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prehlad">Prehľad</TabsTrigger>
          <TabsTrigger value="provizie">Provízie</TabsTrigger>
          <TabsTrigger value="platby">Platby</TabsTrigger>
          <TabsTrigger value="poznamka">Poznámka</TabsTrigger>
        </TabsList>

        <TabsContent value="prehlad">
          <section className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {isStandalone ? <StandaloneEntityBadge /> : <ConfirmedLinkBadge label="Viazaný na prenájom" />}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Klient" value={record.client_name || "—"} />
            <Field label="E-mail">
              {(() => {
                const href = adminCustomerHrefPreferred((record as any).customer_id, record.customer_email);
                return href ? (
                  <Link to={href} className="text-primary hover:underline">
                    {record.customer_email}
                  </Link>
                ) : (
                  "—"
                );
              })()}
            </Field>
            <Field label="Poskytovateľ" value={record.provider || "—"} />
            <Field label="Cena / mesiac" value={record.monthly_price != null ? `${record.monthly_price} €` : "—"} />
            <Field label="Domény" value={record.domains_count != null ? String(record.domains_count) : "—"} />
            <Field label="Získal" value={record.acquired_by || "—"} />
            <Field label="Provízny">
              <Badge variant={record.commissionable ? "default" : "outline"} className="text-[10px]">
                {record.commissionable ? "áno" : "nie"}
              </Badge>
            </Field>
            <Field label="Stav">
              <Badge variant={record.active ? "secondary" : "outline"} className="text-[10px]">
                {record.active ? "aktívny" : "neaktívny"}
              </Badge>
            </Field>
            <Field label="Prepojený prenájom">
              {linkedRental ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to="/admin/rentals" className="text-primary hover:underline">
                    {linkedRental.name || linkedRental.url}
                  </Link>
                  <ConfirmedLinkBadge />
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">Samostatný hosting bez rental_website_id</span>
              )}
            </Field>
            {estimatedProjects.length > 0 && (
              <Field label="Možné projekty">
                <div className="space-y-1">
                  <EstimatedLinkBadge />
                  <ul className="text-xs space-y-0.5 mt-1">
                    {estimatedProjects.map((p) => (
                      <li key={p.id}>
                        <Link to={`/admin/projects/${p.id}`} className="text-primary hover:underline">
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Field>
            )}
            <Field label="Vytvorené" value={new Date(record.created_at).toLocaleString("sk-SK")} />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="provizie">
          <EntityCommissionsPanel
            sourceType="hosting"
            sourceId={record.id}
            customerEmail={record.customer_email}
            customerId={(record as any).customer_id}
            defaultTitle={`Hosting — ${label}`}
          />
        </TabsContent>

        <TabsContent value="platby">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Žiadne platobné záznamy prepojené s týmto hostingom.
            </p>
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Suma</TableHead>
                    <TableHead>Poznámka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString("sk-SK") : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{Number(p.amount || 0).toFixed(2)} €</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="poznamka">
          {record.note ? (
            <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{record.note}</div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Žiadna poznámka.
            </p>
          )}
        </TabsContent>
      </Tabs>
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
