import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  LogOut,
  ShieldAlert,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  AlertTriangle,
  Lock,
  Clock,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { STATUS_CONFIG, type LeadStatus } from "@/components/admin/leads/constants";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  source: string | null;
  assigned_to: string | null;
  temperature: string | null;
  created_at: string;
};

type Task = {
  id: string;
  title: string;
  status: string;
  amount: number | null;
  deposit: number | null;
  due_date: string | null;
  updated_at: string;
  client_name: string | null;
  lead_id: string | null;
  matchedBy: "lead_id" | "client_name";
};

type Rental = {
  id: string;
  name: string;
  url: string | null;
  monthly_price: number;
  implementers: unknown;
  client_name: string | null;
};

type Signature = {
  id: string;
  client_name: string;
  email: string;
  plan: string;
  package_name: string | null;
  price: number;
  contract_months: number;
  status: string;
  signed_at: string;
  created_at: string;
};

type Note = {
  id: string;
  title: string;
  client_name: string | null;
  url: string | null;
  status: string;
  has_credentials: boolean;
};

type Wheel = {
  id: string;
  email: string;
  prize_label: string;
  prize_value: number;
  redeemed: boolean;
  created_at: string;
};

type Design = {
  id: string;
  client_name: string;
  email: string | null;
  design_url: string | null;
  sent_date: string;
  status: string;
  matchedBy: "email" | "client_name";
};

type LeadLog = {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  created_at: string;
};

type ActivityItem = {
  id: string;
  at: string;
  label: string;
  detail?: string;
  href?: string;
};

const LOG_FIELD_LABEL: Record<string, string> = {
  status: "Status",
  type: "Typ",
  assigned_to: "Kto rieši",
  temperature: "Teplota",
  source: "Zdroj",
  name: "Meno",
  email: "E-mail",
  phone: "Telefón",
  notes: "Poznámky",
  amount: "Suma",
};

const DESIGN_STATUS_LABEL: Record<string, string> = {
  sent: "Zaslané",
  viewed: "Pozreté",
  approved: "Schválené",
  rejected: "Zamietnuté",
  revision: "Úpravy",
};

const SIGNATURE_STATUS_LABEL: Record<string, string> = {
  signed: "Podpísané",
  in_progress: "Realizuje sa",
  done: "Hotové",
  canceled: "Zrušené",
};

const NOTE_STATUS_LABEL: Record<string, string> = {
  in_progress: "Prebieha",
  waiting: "Čaká",
  done: "Hotové",
  archived: "Archivované",
};

const logSummary = (log: LeadLog) => {
  if (log.action === "updated" && log.field) {
    const field = LOG_FIELD_LABEL[log.field] || log.field;
    const from = log.old_value ?? "—";
    const to = log.new_value ?? "—";
    return `${field}: ${from} → ${to}`;
  }
  if (log.action === "created") return "Lead vytvorený";
  if (log.action === "deleted") return "Lead vymazaný";
  if (log.action === "notification") return log.new_value || "Notifikácia";
  if (log.action === "wheel_spin") return log.new_value || "Spin na kolese";
  return log.action;
};

const SectionCard = ({
  title,
  link,
  linkLabel,
  children,
  uncertain,
}: {
  title: string;
  link?: string;
  linkLabel?: string;
  children: React.ReactNode;
  uncertain?: boolean;
}) => (
  <section className="rounded-xl border border-border bg-card">
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {uncertain && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <AlertTriangle className="w-3 h-3" />
            možná zhoda
          </Badge>
        )}
      </div>
      {link && (
        <Link to={link}>
          <Button variant="ghost" size="sm" className="text-xs h-7">
            {linkLabel || "Otvoriť modul"}
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      )}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const Empty = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground italic">{text}</p>
);

const AdminCustomer = () => {
  const navigate = useNavigate();
  const { customerKey = "" } = useParams();
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();

  const decodedKey = decodeURIComponent(customerKey).trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [logs, setLogs] = useState<LeadLog[]>([]);

  useEffect(() => {
    document.title = `Zákazník · ${decodedKey} | CRM`;
  }, [decodedKey]);

  useEffect(() => {
    if (authChecking) return;
    if (!userId) navigate("/auth", { replace: true });
  }, [authChecking, userId, navigate]);

  useEffect(() => {
    if (!isAdmin || !decodedKey) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id,name,email,phone,status,source,assigned_to,temperature,created_at")
          .ilike("email", decodedKey)
          .order("created_at", { ascending: false });

        const leadRows = (leadsData || []) as Lead[];
        setLeads(leadRows);

        const leadIds = leadRows.map((l) => l.id);
        const leadNames = Array.from(
          new Set(leadRows.map((l) => (l.name || "").trim()).filter(Boolean)),
        );

        const taskQueries: Promise<{ data: any[] | null }>[] = [];
        if (leadIds.length) {
          taskQueries.push(
            supabase
              .from("tasks")
              .select("id,title,status,amount,deposit,due_date,updated_at,client_name,lead_id")
              .in("lead_id", leadIds) as any,
          );
        }
        if (leadNames.length) {
          taskQueries.push(
            supabase
              .from("tasks")
              .select("id,title,status,amount,deposit,due_date,updated_at,client_name,lead_id")
              .in("client_name", leadNames) as any,
          );
        }
        const taskResults = await Promise.all(taskQueries);
        const seenTasks = new Map<string, Task>();
        taskResults.forEach((res) => {
          (res.data || []).forEach((t: any) => {
            const matchedBy: Task["matchedBy"] =
              t.lead_id && leadIds.includes(t.lead_id) ? "lead_id" : "client_name";
            if (!seenTasks.has(t.id)) {
              seenTasks.set(t.id, { ...t, matchedBy });
            } else if (matchedBy === "lead_id") {
              seenTasks.set(t.id, { ...t, matchedBy });
            }
          });
        });
        setTasks(Array.from(seenTasks.values()));

        let rentalRows: Rental[] = [];
        if (leadNames.length) {
          const { data } = await supabase
            .from("rental_websites")
            .select("id,name,url,monthly_price,implementers,client_name")
            .in("client_name", leadNames);
          rentalRows = (data || []) as Rental[];
        }
        setRentals(rentalRows);

        const { data: sigData } = await supabase
          .from("order_signatures")
          .select(
            "id,client_name,email,plan,package_name,price,contract_months,status,signed_at,created_at",
          )
          .ilike("email", decodedKey)
          .order("signed_at", { ascending: false });
        setSignatures((sigData || []) as Signature[]);

        let noteRows: Note[] = [];
        if (leadNames.length) {
          const { data } = await supabase
            .from("project_notes")
            .select("id,title,client_name,url,status,username,password")
            .in("client_name", leadNames);
          noteRows = (data || []).map((n: any) => ({
            id: n.id,
            title: n.title,
            client_name: n.client_name,
            url: n.url,
            status: n.status,
            has_credentials: !!(n.username || n.password),
          }));
        }
        setNotes(noteRows);

        const { data: wheelData } = await supabase
          .from("wheel_spins")
          .select("id,email,prize_label,prize_value,redeemed,created_at")
          .ilike("email", decodedKey)
          .order("created_at", { ascending: false });
        setWheels((wheelData || []) as Wheel[]);

        const seenDesigns = new Map<string, Design>();
        const { data: designsByEmail } = await supabase
          .from("design_proposals")
          .select("id,client_name,email,design_url,sent_date,status")
          .ilike("email", decodedKey)
          .order("sent_date", { ascending: false });
        (designsByEmail || []).forEach((d: any) => {
          seenDesigns.set(d.id, { ...d, matchedBy: "email" });
        });
        if (leadNames.length) {
          const { data: designsByName } = await supabase
            .from("design_proposals")
            .select("id,client_name,email,design_url,sent_date,status")
            .in("client_name", leadNames)
            .order("sent_date", { ascending: false });
          (designsByName || []).forEach((d: any) => {
            if (!seenDesigns.has(d.id)) {
              seenDesigns.set(d.id, { ...d, matchedBy: "client_name" });
            }
          });
        }
        setDesigns(Array.from(seenDesigns.values()));

        const seenLogs = new Map<string, LeadLog>();
        const logQueries: Promise<{ data: any[] | null }>[] = [];
        if (leadIds.length) {
          logQueries.push(
            supabase
              .from("lead_logs")
              .select(
                "id,lead_id,lead_name,lead_email,action,field,old_value,new_value,changed_by_email,created_at",
              )
              .in("lead_id", leadIds)
              .order("created_at", { ascending: false })
              .limit(25) as any,
          );
        }
        logQueries.push(
          supabase
            .from("lead_logs")
            .select(
              "id,lead_id,lead_name,lead_email,action,field,old_value,new_value,changed_by_email,created_at",
            )
            .ilike("lead_email", decodedKey)
            .order("created_at", { ascending: false })
            .limit(25) as any,
        );
        const logResults = await Promise.all(logQueries);
        logResults.forEach((res) => {
          (res.data || []).forEach((row: LeadLog) => {
            if (!seenLogs.has(row.id)) seenLogs.set(row.id, row);
          });
        });
        const sortedLogs = Array.from(seenLogs.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setLogs(sortedLogs.slice(0, 15));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin, decodedKey]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const primaryLead = leads[0];
  const displayName = primaryLead?.name || signatures[0]?.client_name || decodedKey;
  const phone = primaryLead?.phone || null;
  const company =
    rentals[0]?.client_name || signatures[0]?.client_name || primaryLead?.name || null;

  let lifecycle: { label: string; tone: string } = {
    label: "Bez histórie",
    tone: "bg-muted text-muted-foreground",
  };
  if (signatures.length > 0) {
    lifecycle = {
      label: "Aktívny zákazník",
      tone: "bg-green-500/15 text-green-700 dark:text-green-400",
    };
  } else if (leads.length > 0) {
    lifecycle = { label: "Lead v pipeline", tone: "bg-primary/15 text-primary" };
  }

  const recentActivity = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];

    logs.slice(0, 8).forEach((log) => {
      items.push({
        id: `log-${log.id}`,
        at: log.created_at,
        label: logSummary(log),
        detail: log.lead_name || log.lead_email || undefined,
        href: log.lead_id ? `/admin?lead=${log.lead_id}` : undefined,
      });
    });

    signatures.slice(0, 3).forEach((s) => {
      items.push({
        id: `sig-${s.id}`,
        at: s.signed_at || s.created_at,
        label: `Podpis objednávky · ${s.package_name || s.plan}`,
        detail: `${Number(s.price).toLocaleString("sk-SK")} €`,
        href: "/admin/signatures",
      });
    });

    designs.slice(0, 3).forEach((d) => {
      items.push({
        id: `design-${d.id}`,
        at: d.sent_date,
        label: `Dizajn zaslaný · ${DESIGN_STATUS_LABEL[d.status] || d.status}`,
        detail: d.design_url || d.client_name,
        href: "/admin/designs",
      });
    });

    wheels.slice(0, 2).forEach((w) => {
      items.push({
        id: `wheel-${w.id}`,
        at: w.created_at,
        label: `Koleso · ${w.prize_label}`,
        detail: w.redeemed ? "uplatnené" : "neuplatnené",
        href: "/admin/wheel-leads",
      });
    });

    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);
  }, [logs, signatures, designs, wheels]);

  const hasAnyData =
    leads.length +
      tasks.length +
      rentals.length +
      signatures.length +
      notes.length +
      wheels.length +
      designs.length >
    0;

  const leadStatusLabel = (status: string) =>
    STATUS_CONFIG[status as LeadStatus]?.label || status;

  if (authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Nemáte prístup</h1>
          <p className="text-muted-foreground">
            Účet <strong>{userEmail}</strong> nemá pridelenú admin rolu.
          </p>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button onClick={() => navigate("/admin")} variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">Zákazník 360°</h1>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button onClick={() => navigate("/admin")} variant="outline" size="sm">
              Pipeline →
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-5xl">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Prehľad zákazníka
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold truncate">{displayName}</h2>
                <Badge className={`text-[10px] ${lifecycle.tone}`} variant="outline">
                  {lifecycle.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {decodedKey}
                </span>
                {phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {phone}
                  </span>
                )}
                {company && company !== displayName && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {company}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground justify-end">
              <span>{leads.length} leadov</span>
              <span>·</span>
              <span>{tasks.length} úloh</span>
              <span>·</span>
              <span>{signatures.length} podpisov</span>
              <span>·</span>
              <span>{designs.length} dizajnov</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
            <Button size="sm" variant="outline" onClick={() => navigate("/admin")}>
              Pipeline
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/tasks")}>
              Úlohy
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/rentals")}>
              Prenájmy
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/notes")}>
              Poznámky
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/designs")}>
              Dizajny
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/logs")}>
              Logy
            </Button>
            {primaryLead && (
              <Button
                size="sm"
                variant="default"
                onClick={() => navigate(`/admin?lead=${primaryLead.id}`)}
              >
                Otvoriť hlavný lead
              </Button>
            )}
          </div>
        </section>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !hasAnyData ? (
          <section className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
            <p className="text-sm font-medium">Pre tento email zatiaľ nemáme záznamy v CRM.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Skontrolujte preklep v emaile alebo vytvorte lead v pipeline.
            </p>
            <Button size="sm" onClick={() => navigate("/admin")}>
              Prejsť do pipeline
            </Button>
          </section>
        ) : (
          <>
            {recentActivity.length > 0 && (
              <SectionCard title="Posledná aktivita" link="/admin/logs" linkLabel="Všetky logy">
                <ul className="divide-y divide-border text-xs">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                          {item.label}
                        </div>
                        {item.detail && (
                          <div className="text-muted-foreground text-[11px] mt-0.5 truncate pl-4">
                            {item.detail}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground pl-4 mt-0.5">
                          {new Date(item.at).toLocaleString("sk-SK")}
                        </div>
                      </div>
                      {item.href && (
                        <Link to={item.href} className="shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Detail
                          </Button>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <SectionCard title="Leady v pipeline" link="/admin" linkLabel="Pipeline">
              {leads.length === 0 ? (
                <Empty text="Žiadne leady pre tento email." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {leads.map((l) => (
                    <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.name}</div>
                        <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap">
                          <span>{new Date(l.created_at).toLocaleDateString("sk-SK")}</span>
                          {l.source && <span>· {l.source}</span>}
                          {l.assigned_to && <span>· {l.assigned_to}</span>}
                          {l.temperature && <span>· {l.temperature}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {leadStatusLabel(l.status)}
                        </Badge>
                        <Link to={`/admin?lead=${l.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Otvoriť lead
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Úlohy"
              link="/admin/tasks"
              linkLabel="Modul úloh"
              uncertain={tasks.some((t) => t.matchedBy === "client_name")}
            >
              {tasks.length === 0 ? (
                <Empty text="Žiadne úlohy spárované cez lead alebo meno klienta." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {tasks.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap">
                          <span>{t.status}</span>
                          {t.due_date && (
                            <span>
                              · termín {new Date(t.due_date).toLocaleDateString("sk-SK")}
                            </span>
                          )}
                          <span>· upd {new Date(t.updated_at).toLocaleDateString("sk-SK")}</span>
                          {t.matchedBy === "client_name" && (
                            <span className="text-amber-600">· zhoda podľa mena</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          {t.amount != null && t.amount > 0 && (
                            <div className="font-semibold">
                              {Number(t.amount).toLocaleString("sk-SK")} €
                            </div>
                          )}
                          {t.deposit != null && t.deposit > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              záloha {Number(t.deposit).toLocaleString("sk-SK")} €
                            </div>
                          )}
                        </div>
                        <Link to="/admin/tasks">
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Modul
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Prenájmy webov"
              link="/admin/rentals"
              linkLabel="Modul prenájmov"
              uncertain={rentals.length > 0}
            >
              {rentals.length === 0 ? (
                <Empty text="Žiadne weby spárované cez meno klienta." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {rentals.map((r) => {
                    const impl = Array.isArray(r.implementers) ? r.implementers : [];
                    return (
                      <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap">
                            {r.url && (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate"
                              >
                                {r.url}
                              </a>
                            )}
                            {impl.length > 0 && <span>· {impl.length} implementátorov</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-semibold">
                          {Number(r.monthly_price).toLocaleString("sk-SK")} € / mes.
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Podpisy objednávok" link="/admin/signatures" linkLabel="Modul podpisov">
              {signatures.length === 0 ? (
                <Empty text="Žiadne podpisy objednávky." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {signatures.map((s) => (
                    <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.package_name || s.plan}</div>
                        <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap items-center">
                          <span>
                            {new Date(s.signed_at || s.created_at).toLocaleDateString("sk-SK")}
                          </span>
                          <span>· {s.contract_months} mes.</span>
                          <Badge variant="outline" className="text-[10px]">
                            {SIGNATURE_STATUS_LABEL[s.status] || s.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-semibold">
                        {Number(s.price).toLocaleString("sk-SK")} €
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Zaslané dizajny"
              link="/admin/designs"
              linkLabel="Modul dizajnov"
              uncertain={designs.some((d) => d.matchedBy === "client_name")}
            >
              {designs.length === 0 ? (
                <Empty text="Žiadne zaslané dizajny pre tento email alebo meno klienta." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {designs.map((d) => (
                    <li key={d.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.client_name}</div>
                        <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap items-center">
                          <span>{new Date(d.sent_date).toLocaleDateString("sk-SK")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {DESIGN_STATUS_LABEL[d.status] || d.status}
                          </Badge>
                          {d.matchedBy === "client_name" && (
                            <span className="text-amber-600">· zhoda podľa mena</span>
                          )}
                        </div>
                        {d.design_url && (
                          <a
                            href={d.design_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline truncate block mt-0.5"
                          >
                            {d.design_url}
                          </a>
                        )}
                      </div>
                      <Link to="/admin/designs">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          Modul
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Projektové poznámky a prístupy"
              link="/admin/notes"
              linkLabel="Modul poznámok"
              uncertain={notes.length > 0}
            >
              {notes.length === 0 ? (
                <Empty text="Žiadne projektové poznámky pre toto meno." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {notes.map((n) => (
                    <li key={n.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{n.title}</div>
                        <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap items-center">
                          <Badge variant="outline" className="text-[10px]">
                            {NOTE_STATUS_LABEL[n.status] || n.status}
                          </Badge>
                          {n.url && <span className="truncate">{n.url}</span>}
                          {n.has_credentials && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Lock className="w-3 h-3" /> prístupy uložené (read-only)
                            </span>
                          )}
                        </div>
                      </div>
                      <Link to="/admin/notes">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          Modul
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="CRM logy" link="/admin/logs" linkLabel="Všetky logy">
              {logs.length === 0 ? (
                <Empty text="Žiadne logy pre leady tohto zákazníka." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {logs.map((log) => (
                    <li key={log.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{logSummary(log)}</div>
                        <div className="text-muted-foreground text-[11px] flex gap-2 flex-wrap">
                          <span>{new Date(log.created_at).toLocaleString("sk-SK")}</span>
                          {log.lead_name && <span>· {log.lead_name}</span>}
                          {log.changed_by_email && <span>· {log.changed_by_email}</span>}
                        </div>
                      </div>
                      {log.lead_id ? (
                        <Link to={`/admin?lead=${log.lead_id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Lead
                          </Button>
                        </Link>
                      ) : (
                        <Link to="/admin/logs">
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Logy
                          </Button>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {wheels.length > 0 && (
              <SectionCard title="Koleso šťastia" link="/admin/wheel-leads" linkLabel="Modul wheel">
                <ul className="divide-y divide-border text-xs">
                  {wheels.map((w) => (
                    <li key={w.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{w.prize_label}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {new Date(w.created_at).toLocaleDateString("sk-SK")}
                          {w.redeemed ? " · uplatnené" : " · neuplatnené"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {w.prize_value > 0 && (
                          <div className="text-right font-semibold">{w.prize_value} %</div>
                        )}
                        <Link to="/admin/wheel-leads">
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Modul
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default AdminCustomer;
