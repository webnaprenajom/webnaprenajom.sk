import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, ListTodo, AlertTriangle, Clock, Sun } from "lucide-react";

interface LeadLite {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  source: string | null;
  follow_up_date?: string | null;
}

interface TaskLite {
  id: string;
  title: string;
  client_name: string | null;
  due_date: string | null;
  status: string;
  priority: string;
}

interface Props {
  refreshKey?: number;
  onLeadClick?: (id: string) => void;
}

const TodayMustDoSection = ({ refreshKey, onLeadClick }: Props) => {
  const navigate = useNavigate();
  const [callLeads, setCallLeads] = useState<LeadLite[]>([]);
  const [offerLeads, setOfferLeads] = useState<LeadLite[]>([]);
  const [followUpLeads, setFollowUpLeads] = useState<LeadLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [refreshKey]);

  const load = async () => {
    setLoading(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const [callRes, offerRes, followUpRes, taskRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id,name,email,phone,status,created_at,source")
        .eq("status", "to_call")
        .order("created_at", { ascending: true })
        .limit(50),
      supabase
        .from("leads")
        .select("id,name,email,phone,status,created_at,source")
        .in("status", ["send_offer", "reminder"])
        .order("created_at", { ascending: true })
        .limit(50),
      supabase
        .from("leads")
        .select("id,name,email,phone,status,created_at,source,follow_up_date")
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", todayStr)
        .not("status", "in", "(won,lost)")
        .order("follow_up_date", { ascending: true })
        .limit(50),
      supabase
        .from("tasks")
        .select("id,title,client_name,due_date,status,priority")
        .neq("status", "done")
        .neq("status", "paid")
        .not("due_date", "is", null)
        .lte("due_date", todayStr)
        .order("due_date", { ascending: true })
        .limit(50),
    ]);

    setCallLeads((callRes.data || []) as LeadLite[]);
    setOfferLeads((offerRes.data || []) as LeadLite[]);
    setFollowUpLeads((followUpRes.data || []) as LeadLite[]);
    setTasks((taskRes.data || []) as TaskLite[]);
    setLoading(false);
  };

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (d: string | null) => !!d && d < today;

  const totalCount = callLeads.length + offerLeads.length + followUpLeads.length + tasks.length;

  if (loading) return null;
  if (totalCount === 0) {
    return (
      <section className="rounded-xl border border-border bg-card/50 p-4 flex items-center gap-3">
        <Sun className="w-5 h-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Dnes musíš urobiť:</span> nič urgentné.
          Užite si pokoj 🎉
        </p>
      </section>
    );
  }

  const handleLead = (l: LeadLite) => {
    if (onLeadClick) onLeadClick(l.id);
  };

  return (
    <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4 md:p-5">
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Dnes musíš urobiť
          <Badge variant="outline" className="ml-2 text-xs">
            {totalCount} akcií
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground">
          Akcie zoradené od najstaršieho · zmeškané termíny zvýraznené červenou
        </p>
      </header>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Follow-up leads */}
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
          <div className="flex items-center gap-2 mb-3 text-violet-500 font-semibold text-sm">
            <Clock className="w-4 h-4" />
            Ozvať sa ({followUpLeads.length})
          </div>
          {followUpLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Žiadne follow-upy na dnes</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {followUpLeads.map((l) => {
                const overdue = !!l.follow_up_date && l.follow_up_date < today;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => handleLead(l)}
                      className={`w-full text-left rounded-md p-2 border transition-colors ${
                        overdue
                          ? "bg-red-500/10 border-red-500/40 hover:bg-red-500/20"
                          : "bg-background/60 border-transparent hover:bg-violet-500/10 hover:border-violet-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate flex items-center gap-1">
                          {overdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          {l.name}
                        </span>
                        <span className={`text-[10px] whitespace-nowrap ${overdue ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                          {l.follow_up_date
                            ? new Date(l.follow_up_date).toLocaleDateString("sk-SK", { day: "numeric", month: "short" })
                            : ""}
                        </span>
                      </div>
                      {l.phone ? (
                        <div className="text-[11px] text-violet-500 font-mono mt-0.5">{l.phone}</div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {l.email}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>


        {/* Call leads */}
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
          <div className="flex items-center gap-2 mb-3 text-indigo-500 font-semibold text-sm">
            <Phone className="w-4 h-4" />
            Zavolať ({callLeads.length})
          </div>
          {callLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Žiadne hovory na dnes</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {callLeads.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => handleLead(l)}
                    className="w-full text-left rounded-md p-2 bg-background/60 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{l.name}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleDateString("sk-SK", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {l.phone && (
                      <div className="text-[11px] text-indigo-500 font-mono mt-0.5">{l.phone}</div>
                    )}
                    {!l.phone && (
                      <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {l.email}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Offer / reminder */}
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
          <div className="flex items-center gap-2 mb-3 text-cyan-500 font-semibold text-sm">
            <Mail className="w-4 h-4" />
            Poslať ponuku / reminder ({offerLeads.length})
          </div>
          {offerLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nič na odoslanie</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {offerLeads.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => handleLead(l)}
                    className="w-full text-left rounded-md p-2 bg-background/60 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{l.name}</span>
                      <Badge
                        variant="outline"
                        className={
                          l.status === "send_offer"
                            ? "bg-cyan-500/15 text-cyan-500 border-cyan-500/30 text-[10px] px-1.5 py-0"
                            : "bg-orange-500/15 text-orange-500 border-orange-500/30 text-[10px] px-1.5 py-0"
                        }
                      >
                        {l.status === "send_offer" ? "Ponuka" : "Reminder"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {l.email}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-orange-500 font-semibold text-sm">
              <ListTodo className="w-4 h-4" />
              Úlohy na dnes ({tasks.length})
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/tasks")}
              className="text-[10px] text-muted-foreground hover:text-primary underline"
            >
              Otvoriť
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Žiadne termíny dnes</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {tasks.map((t) => {
                const overdue = isOverdue(t.due_date);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/tasks")}
                      className={`w-full text-left rounded-md p-2 border transition-colors ${
                        overdue
                          ? "bg-red-500/10 border-red-500/40 hover:bg-red-500/20"
                          : "bg-background/60 border-transparent hover:bg-orange-500/10 hover:border-orange-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate flex items-center gap-1">
                          {overdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          {t.title}
                        </span>
                        <span
                          className={`text-[10px] whitespace-nowrap inline-flex items-center gap-1 ${
                            overdue ? "text-red-500 font-bold" : "text-muted-foreground"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {t.due_date
                            ? new Date(t.due_date).toLocaleDateString("sk-SK", {
                                day: "numeric",
                                month: "short",
                              })
                            : ""}
                        </span>
                      </div>
                      {t.client_name && (
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {t.client_name}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default TodayMustDoSection;
