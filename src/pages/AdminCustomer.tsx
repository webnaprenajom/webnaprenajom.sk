import { useEffect, useState } from "react";
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
} from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAdminAccess } from "@/hooks/useAdminAccess";

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

  useEffect(() => {
    document.title = `Customer · ${decodedKey} | CRM`;
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
        // Leads by email
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id,name,email,phone,status,source,assigned_to,temperature,created_at")
          .ilike("email", decodedKey)
          .order("created_at", { ascending: false });

        const leadRows = (leadsData || []) as Lead[];
        setLeads(leadRows);

        const leadIds = leadRows.map((l) => l.id);
        const leadNames = Array.from(
          new Set(leadRows.map((l) => (l.name || "").trim()).filter(Boolean))
        );

        // Tasks: by lead_id OR client_name match
        const taskQueries: Promise<{ data: any[] | null }>[] = [];
        if (leadIds.length) {
          taskQueries.push(
            supabase
              .from("tasks")
              .select("id,title,status,amount,deposit,due_date,updated_at,client_name,lead_id")
              .in("lead_id", leadIds) as any
          );
        }
        if (leadNames.length) {
          taskQueries.push(
            supabase
              .from("tasks")
              .select("id,title,status,amount,deposit,due_date,updated_at,client_name,lead_id")
              .in("client_name", leadNames) as any
          );
        }
        const taskResults = await Promise.all(taskQueries);
        const seenTasks = new Map<string, Task>();
        taskResults.forEach((res, idx) => {
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

        // Rentals by client_name (uncertain)
        let rentalRows: Rental[] = [];
        if (leadNames.length) {
          const { data } = await supabase
            .from("rental_websites")
            .select("id,name,url,monthly_price,implementers,client_name")
            .in("client_name", leadNames);
          rentalRows = (data || []) as Rental[];
        }
        setRentals(rentalRows);

        // Signatures by email
        const { data: sigData } = await supabase
          .from("order_signatures")
          .select("id,client_name,email,plan,package_name,price,contract_months,created_at")
          .ilike("email", decodedKey)
          .order("created_at", { ascending: false });
        setSignatures((sigData || []) as Signature[]);

        // Notes by client_name (uncertain)
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

        // Wheel spins by email
        const { data: wheelData } = await supabase
          .from("wheel_spins")
          .select("id,email,prize_label,prize_value,redeemed,created_at")
          .ilike("email", decodedKey)
          .order("created_at", { ascending: false });
        setWheels((wheelData || []) as Wheel[]);
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

  // Header derived data
  const primaryLead = leads[0];
  const displayName = primaryLead?.name || signatures[0]?.client_name || decodedKey;
  const phone = primaryLead?.phone || null;
  const company =
    rentals[0]?.client_name || signatures[0]?.client_name || primaryLead?.name || null;

  // Lifecycle hint
  let lifecycle: { label: string; tone: string } = { label: "unknown", tone: "bg-muted" };
  if (signatures.length > 0) {
    lifecycle = { label: "active", tone: "bg-green-500/15 text-green-700 dark:text-green-400" };
  } else if (leads.length > 0) {
    lifecycle = { label: "lead", tone: "bg-primary/15 text-primary" };
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
              <h1 className="text-base sm:text-xl font-bold truncate">Customer view</h1>
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
        {/* Customer header card */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
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
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{leads.length} leadov</span>
              <span>·</span>
              <span>{signatures.length} podpisov</span>
              <span>·</span>
              <span>{tasks.length} úloh</span>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SectionCard title="Lead history" link="/admin" linkLabel="Otvoriť /admin">
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
                        <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                        <Link to={`/admin?lead=${l.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Otvoriť
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Tasks"
              link="/admin/tasks"
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
                          {t.due_date && <span>· termín {new Date(t.due_date).toLocaleDateString("sk-SK")}</span>}
                          <span>· upd {new Date(t.updated_at).toLocaleDateString("sk-SK")}</span>
                          {t.matchedBy === "client_name" && (
                            <span className="text-amber-600">· match by name</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {t.amount != null && t.amount > 0 && (
                          <div className="font-semibold">{Number(t.amount).toLocaleString("sk-SK")} €</div>
                        )}
                        {t.deposit != null && t.deposit > 0 && (
                          <div className="text-[10px] text-muted-foreground">záloha {Number(t.deposit).toLocaleString("sk-SK")} €</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Rentals"
              link="/admin/rentals"
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
                            {r.url && <span className="truncate">{r.url}</span>}
                            {impl.length > 0 && <span>· {impl.length} impl.</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-semibold">
                          {Number(r.monthly_price).toLocaleString("sk-SK")} € / mes
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Signatures" link="/admin/signatures">
              {signatures.length === 0 ? (
                <Empty text="Žiadne podpisy objednávky." />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {signatures.map((s) => (
                    <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {s.package_name || s.plan}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {new Date(s.created_at).toLocaleDateString("sk-SK")} · {s.contract_months} mes
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
              title="Notes & prístupy"
              link="/admin/notes"
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
                          <Badge variant="outline" className="text-[10px]">{n.status}</Badge>
                          {n.url && <span className="truncate">{n.url}</span>}
                          {n.has_credentials && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Lock className="w-3 h-3" /> prístupy uložené
                            </span>
                          )}
                        </div>
                      </div>
                      <Link to="/admin/notes">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          Otvoriť
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {wheels.length > 0 && (
              <SectionCard title="Wheel of fortune" link="/admin/wheel-leads">
                <ul className="divide-y divide-border text-xs">
                  {wheels.map((w) => (
                    <li key={w.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{w.prize_label}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {new Date(w.created_at).toLocaleDateString("sk-SK")}
                          {w.redeemed && " · uplatnené"}
                        </div>
                      </div>
                      {w.prize_value > 0 && (
                        <div className="text-right shrink-0 font-semibold">
                          {w.prize_value} %
                        </div>
                      )}
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
