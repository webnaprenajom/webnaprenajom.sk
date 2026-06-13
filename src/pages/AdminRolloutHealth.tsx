import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildIdentityHealthChecklist,
  fetchIdentityHealthCounts,
  type IdentityHealthCounts,
  type IdentityHealthItem,
} from "@/lib/crmLookup/identityHealthReport";
import { RC1_QA_CHECKLIST, RELEASE_NOTES_RC1 } from "@/lib/rollout/releaseNotesRc1";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

const SEVERITY_CLASS: Record<IdentityHealthItem["severity"], string> = {
  ok: "border-emerald-500/30 bg-emerald-500/5",
  info: "border-amber-500/30 bg-amber-500/5",
  warn: "border-red-500/30 bg-red-500/5",
};

const emptyCounts = (): IdentityHealthCounts => ({
  legacyCommissions: 0,
  partialCommissions: 0,
  leadsWithoutCustomer: 0,
  unlinkedInboundComm: 0,
  openTasksWithoutCustomer: 0,
  tasksBackfillableViaLead: 0,
  rentalsWithoutCustomer: 0,
  rentalsBackfillableViaLead: 0,
  commissionsWithoutCustomer: 0,
  duplicateCustomerCandidates: 0,
  customersWithoutEmail: 0,
});

function HealthRow({ item }: { item: IdentityHealthItem }) {
  return (
    <li
      className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${SEVERITY_CLASS[item.severity]}`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{item.title}</span>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {item.count}
          </Badge>
          {item.severity === "ok" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden />
          )}
          {item.severity === "warn" && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" aria-hidden />
          )}
        </div>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
      {item.actionHref && item.count > 0 && (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to={item.actionHref}>{item.actionLabel ?? "Otvoriť"}</Link>
        </Button>
      )}
    </li>
  );
}

export default function AdminRolloutHealth() {
  return <AdminRolloutHealthPage />;
}

function AdminRolloutHealthPage() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<IdentityHealthCounts>(emptyCounts);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchIdentityHealthCounts();
    if (fetchError) setError(fetchError);
    else if (data) setCounts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Stav CRM · identita | Admin";
    void load();
  }, [load]);

  const checklist = buildIdentityHealthChecklist(counts);
  const openIssues = checklist.filter((i) => i.count > 0).length;

  return (
    <AdminShell
      title="Stav CRM · identita a dáta"
      subtitle="Golden-record health, legacy checklist a QA (RC1–RC5)"
      actions={
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">Obnoviť</span>
        </Button>
      }
    >
      <div className="space-y-8 max-w-4xl">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4 text-primary" />
            Batch RC5 — identita klientov a kvalita dát
          </div>
          <p className="text-xs text-muted-foreground">
            Golden-record pravidlá: customer_id → e-mail → manuálne prepojenie → obmedzená heuristika mena.
            Duplicity sa nezlučujú automaticky — checklist slúži na review a budúci merge nástroj.
            Podrobná dokumentácia:{" "}
            <code className="text-[10px] bg-muted px-1 rounded">scripts/RELEASE_NOTES_RC1.md</code>
          </p>
          {!loading && !error && (
            <p className="text-xs">
              {openIssues === 0 ? (
                <span className="text-emerald-600 font-medium">Všetky položky checklistu sú na nule.</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  {openIssues} kategórií s nevyriešenými záznamami.
                </span>
              )}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Identita a legacy checklist
          </h2>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Načítavam metriky…
            </div>
          ) : (
            <ul className="space-y-2">
              {checklist.map((item) => (
                <HealthRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Release notes — zmeny workflow
          </h2>
          <div className="grid gap-3">
            {RELEASE_NOTES_RC1.map((section) => (
              <article key={section.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h3 className="text-sm font-medium">{section.title}</h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            QA checklist pred nasadením
          </h2>
          <ol className="text-xs space-y-2 list-decimal pl-5 text-muted-foreground">
            {RC1_QA_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <h2 className="text-sm font-semibold">Známy backlog po RC1</h2>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Hromadný backfill tasks.customer_id (len lead.customer_id, nie client_name).</li>
            <li>Automatická reconciliácia inbound bez customer_id (manuálne cez communication-ops).</li>
            <li>Server-side agregácia adopcie workspace (dnes len localStorage v prehliadači).</li>
            <li>Doplnenie provízií so source_type/id pri editácii legacy riadkov.</li>
            <li>Leady → customer_id backfill podľa e-mailovej zhody (Batch F1 follow-up).</li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
