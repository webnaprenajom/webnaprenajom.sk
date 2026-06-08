import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LeadBulkBar from "@/components/admin/leads/LeadBulkBar";
import LeadsToolbar from "@/components/admin/leads/LeadsToolbar";
import LeadsTable from "@/components/admin/leads/LeadsTable";
import LeadDetailDialog from "@/components/admin/leads/LeadDetailDialog";
import {
  ARCHIVE_STATUSES,
  ASSIGNEES,
  Lead,
  LeadStatus,
  LeadTemperature,
  SortDir,
  SortKey,
  STALE_DAYS,
  STATUS_CONFIG,
  UNASSIGNED,
  ViewMode,
  isStale,
  typeLabel,
} from "@/components/admin/leads/constants";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  LogOut,
  TrendingUp,
  Users,
  Calendar as CalendarLucide,
  CheckCircle2,
  Bot,
  Mail,
  ShieldAlert,
  History,
  KanbanSquare,
  Wallet,
  ListTodo,
  Sparkles,
  Menu,
  FileSignature,
  Palette,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/admin/NotificationBell";
import TodayMustDoSection from "@/components/admin/TodayMustDoSection";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TYPE_OPTIONS } from "@/components/admin/leads/constants";

// CSV parser supporting quoted fields with commas/newlines
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); rows.push(cur); cur = []; field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v && v.trim() !== ""));
};

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("current");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<LeadStatus>("new");
  const [editType, setEditType] = useState<string>("ai");
  const [editSource, setEditSource] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTemperature, setEditTemperature] = useState<LeadTemperature>(null);
  const [editAssigned, setEditAssigned] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editConsultDate, setEditConsultDate] = useState<Date | undefined>(undefined);
  const [editConsultTime, setEditConsultTime] = useState<string>("");
  const [editFollowUpDate, setEditFollowUpDate] = useState<Date | undefined>(undefined);
  const [editCreatedAt, setEditCreatedAt] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk send offer dialog
  const [bulkOfferOpen, setBulkOfferOpen] = useState(false);
  const [bulkOfferEmails, setBulkOfferEmails] = useState("");
  const [bulkOfferName, setBulkOfferName] = useState("");
  const [bulkOfferSending, setBulkOfferSending] = useState(false);

  const handleBulkOfferSend = async () => {
    const list = bulkOfferEmails
      .split(/[,;\s\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast({ title: "Žiadne e-maily", description: "Vlož aspoň jednu adresu", variant: "destructive" });
      return;
    }
    setBulkOfferSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-offer-email", {
        body: { name: bulkOfferName.trim() || undefined, emails: list },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      toast({
        title: failed === 0 ? "Ponuky odoslané" : "Čiastočne odoslané",
        description: `Odoslaných: ${sent}${failed ? ` · neúspešné: ${failed}` : ""}`,
        variant: failed === 0 ? undefined : "destructive",
      });
      if (failed === 0) {
        setBulkOfferOpen(false);
        setBulkOfferEmails("");
        setBulkOfferName("");
      }
    } catch (e) {
      toast({
        title: "Odoslanie zlyhalo",
        description: e instanceof Error ? e.message : "Neznáma chyba",
        variant: "destructive",
      });
    } finally {
      setBulkOfferSending(false);
    }
  };

  // Manual add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    phone: "",
    source: "",
    type: "ai",
    status: "new" as LeadStatus,
    assigned_to: "",
    message: "",
    notes: "",
  });

  useEffect(() => {
    document.title = "Admin CRM | Web na prenájom";
  }, [navigate]);

  useEffect(() => {
    if (authChecking) return;

    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }

    if (isAdmin) {
      void loadLeads();
      return;
    }

    setLoading(false);
  }, [authChecking, isAdmin, navigate, userId]);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Chyba načítania", description: error.message, variant: "destructive" });
    } else {
      setLeads((data || []) as Lead[]);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setEditNotes(lead.notes || "");
    setEditStatus(lead.status);
    setEditType(lead.type);
    setEditSource(lead.source || "");
    setEditName(lead.name || "");
    setEditEmail(lead.email || "");
    setEditPhone(lead.phone || "");
    setEditTemperature(lead.temperature ?? null);
    setEditAssigned(lead.assigned_to || "");
    setEditAmount(lead.amount != null ? String(lead.amount) : "");
    setEditConsultDate(lead.consultation_date ? new Date(lead.consultation_date) : undefined);
    setEditConsultTime(lead.consultation_time || "");
    setEditFollowUpDate(lead.follow_up_date ? new Date(lead.follow_up_date) : undefined);
    setEditCreatedAt(lead.created_at ? new Date(lead.created_at) : undefined);
  };

  // Open lead when navigated with ?lead=<id> (e.g. from notification quick action)
  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (!leadId || leads.length === 0) return;
    if (selected?.id === leadId) return;
    const target = leads.find((l) => l.id === leadId);
    if (target) {
      openLead(target);
      // strip the param so re-open is possible after close
      searchParams.delete("lead");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, leads]);

  const handleSave = async () => {
    if (!selected) return;
    if (!editName.trim() || !editEmail.trim()) {
      toast({ title: "Chýbajú údaje", description: "Meno a e-mail sú povinné", variant: "destructive" });
      return;
    }
    setSaving(true);
    const statusChangedToReminder =
      editStatus === "reminder" && selected.status !== "reminder";
    const statusChangedToOffer =
      editStatus === "send_offer" && selected.status !== "send_offer";
    const statusChangedToOrder =
      editStatus === "order" && selected.status !== "order";
    const statusChangedToInstructions =
      editStatus === "send_instructions" && selected.status !== "send_instructions";

    const parsedAmount = editAmount.trim() === "" ? null : Number(editAmount.replace(",", "."));
    if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
      setSaving(false);
      toast({ title: "Neplatná suma", description: "Zadaj číselnú hodnotu", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({
        notes: editNotes,
        status: editStatus,
        type: editType,
        source: editSource || null,
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim() || null,
        temperature: editTemperature,
        assigned_to: editAssigned || null,
        amount: parsedAmount,
        consultation_date: editConsultDate ? editConsultDate.toISOString() : null,
        consultation_time: editConsultTime.trim() || null,
        follow_up_date: editFollowUpDate ? format(editFollowUpDate, "yyyy-MM-dd") : null,
        created_at: editCreatedAt ? editCreatedAt.toISOString() : selected.created_at,
      })
      .eq("id", selected.id);

    if (error) {
      setSaving(false);
      toast({ title: "Uloženie zlyhalo", description: error.message, variant: "destructive" });
      return;
    }

    // Auto-send reminder email when status switches to "reminder"
    if (statusChangedToReminder) {
      try {
        const { error: fnError } = await supabase.functions.invoke("send-reminder-email", {
          body: { name: editName.trim(), email: editEmail.trim() },
        });
        if (fnError) {
          toast({
            title: "Uložené, ale reminder sa neodoslal",
            description: fnError.message,
            variant: "destructive",
          });
        } else {
          toast({ title: "Uložené & reminder odoslaný", description: editEmail.trim() });
        }
      } catch (e) {
        toast({
          title: "Uložené, ale reminder zlyhal",
          description: e instanceof Error ? e.message : "Neznáma chyba",
          variant: "destructive",
        });
      }
    } else if (statusChangedToOffer) {
      try {
        const { error: fnError } = await supabase.functions.invoke("send-offer-email", {
          body: { name: editName.trim(), email: editEmail.trim() },
        });
        if (fnError) {
          toast({
            title: "Uložené, ale ponuka sa neodoslala",
            description: fnError.message,
            variant: "destructive",
          });
        } else {
          toast({ title: "Uložené & ponuka odoslaná", description: editEmail.trim() });
        }
      } catch (e) {
        toast({
          title: "Uložené, ale ponuka zlyhala",
          description: e instanceof Error ? e.message : "Neznáma chyba",
          variant: "destructive",
        });
      }
    } else if (statusChangedToOrder) {
      try {
        const { error: fnError } = await supabase.functions.invoke("send-order-email", {
          body: {
            name: editName.trim(),
            email: editEmail.trim(),
            amount: parsedAmount,
          },
        });
        if (fnError) {
          toast({
            title: "Uložené, ale objednávka sa neodoslala",
            description: fnError.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Uložené & objednávka odoslaná",
            description: `${editEmail.trim()} · zmluva v prílohe`,
          });
        }
      } catch (e) {
        toast({
          title: "Uložené, ale objednávka zlyhala",
          description: e instanceof Error ? e.message : "Neznáma chyba",
          variant: "destructive",
        });
      }
    } else if (statusChangedToInstructions) {
      try {
        const { error: fnError } = await supabase.functions.invoke("send-instructions-email", {
          body: {
            name: editName.trim(),
            email: editEmail.trim(),
            amount: parsedAmount,
          },
        });
        if (fnError) {
          toast({
            title: "Uložené, ale inštrukcie sa neodoslali",
            description: fnError.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Uložené & inštrukcie odoslané",
            description: editEmail.trim(),
          });
        }
      } catch (e) {
        toast({
          title: "Uložené, ale inštrukcie zlyhali",
          description: e instanceof Error ? e.message : "Neznáma chyba",
          variant: "destructive",
        });
      }
    } else {
      toast({ title: "Uložené" });
    }

    setLeads((prev) =>
      prev.map((l) =>
        l.id === selected.id
          ? {
              ...l,
              notes: editNotes,
              status: editStatus,
              type: editType,
              source: editSource || null,
              name: editName.trim(),
              email: editEmail.trim(),
              phone: editPhone.trim() || null,
              temperature: editTemperature,
              assigned_to: editAssigned || null,
              amount: editAmount.trim() === "" ? null : Number(editAmount.replace(",", ".")),
              consultation_date: editConsultDate ? editConsultDate.toISOString() : null,
              consultation_time: editConsultTime.trim() || null,
              follow_up_date: editFollowUpDate ? format(editFollowUpDate, "yyyy-MM-dd") : null,
              created_at: editCreatedAt ? editCreatedAt.toISOString() : l.created_at,
            }
          : l
      )
    );
    setSelected(null);
    setSaving(false);
  };

  const setLeadTemperature = async (lead: Lead, temp: "hot" | "neutral" | "cold") => {
    // Toggle: clicking the same temperature clears it
    const next: LeadTemperature = lead.temperature === temp ? null : temp;
    const prev = lead.temperature;
    // Optimistic update
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, temperature: next } : l)));
    const { error } = await supabase
      .from("leads")
      .update({ temperature: next })
      .eq("id", lead.id);
    if (error) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, temperature: prev } : l)));
      toast({ title: "Zmena zlyhala", description: error.message, variant: "destructive" });
    }
  };

  const setLeadAssignee = async (lead: Lead, assignee: string | null) => {
    const prev = lead.assigned_to;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, assigned_to: assignee } : l)));
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: assignee })
      .eq("id", lead.id);
    if (error) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, assigned_to: prev } : l)));
      toast({ title: "Zmena zlyhala", description: error.message, variant: "destructive" });
    }
  };

  const setLeadStatus = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;
    const prev = { status: lead.status, status_changed_at: lead.status_changed_at };
    const nowIso = new Date().toISOString();
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status, status_changed_at: nowIso } : l)));
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (error) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, ...prev } : l)));
      toast({ title: "Zmena zlyhala", description: error.message, variant: "destructive" });
      return;
    }

    // Auto-send email based on new status (mirrors dialog save logic)
    const emailKind = STATUS_CONFIG[status]?.sendsEmail;
    if (!emailKind) return;
    const fnMap = {
      reminder: { fn: "send-reminder-email", okTitle: "Reminder odoslaný", failTitle: "Reminder sa neodoslal" },
      offer: { fn: "send-offer-email", okTitle: "Ponuka odoslaná", failTitle: "Ponuka sa neodoslala" },
      order: { fn: "send-order-email", okTitle: "Objednávka odoslaná", failTitle: "Objednávka sa neodoslala" },
      instructions: { fn: "send-instructions-email", okTitle: "Inštrukcie odoslané", failTitle: "Inštrukcie sa neodoslali" },
    } as const;
    const cfg = fnMap[emailKind];
    try {
      const { error: fnError } = await supabase.functions.invoke(cfg.fn, {
        body: { name: lead.name, email: lead.email, amount: lead.amount ?? null },
      });
      if (fnError) {
        toast({ title: cfg.failTitle, description: fnError.message, variant: "destructive" });
      } else {
        toast({ title: cfg.okTitle, description: lead.email });
      }
    } catch (e) {
      toast({
        title: cfg.failTitle,
        description: e instanceof Error ? e.message : "Neznáma chyba",
        variant: "destructive",
      });
    }
  };

  const bulkMove = async (target: "stale" | "archive") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const update: any =
      target === "archive"
        ? { status: "lost" as LeadStatus }
        : {
            status: "reminder_silent" as LeadStatus,
            status_changed_at: new Date(Date.now() - (STALE_DAYS + 1) * 86400000).toISOString(),
          };
    const { error } = await supabase.from("leads").update(update).in("id", ids);
    if (error) {
      toast({ title: "Presun zlyhal", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, ...update } : l)));
    setSelectedIds(new Set());
    toast({ title: `Presunutých ${ids.length} leadov`, description: target === "archive" ? "do archívu" : "do 'Bez reakcie'" });
  };

  const bulkSetStatus = async (status: LeadStatus) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase.from("leads").update({ status }).in("id", ids);
    if (error) {
      toast({ title: "Zmena zlyhala", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, status } : l)));
    setSelectedIds(new Set());
    toast({ title: `Aktualizovaných ${ids.length} leadov`, description: STATUS_CONFIG[status]?.label });
  };

  const bulkSetAssignee = async (assignee: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: assignee })
      .in("id", ids);
    if (error) {
      toast({ title: "Priradenie zlyhalo", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, assigned_to: assignee } : l)));
    setSelectedIds(new Set());
    toast({
      title: `Aktualizovaných ${ids.length} leadov`,
      description: assignee ? `Priradené: ${assignee}` : "Nepriradené",
    });
  };

  const bulkSetTemperature = async (temperature: LeadTemperature) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("leads")
      .update({ temperature })
      .in("id", ids);
    if (error) {
      toast({ title: "Zmena teploty zlyhala", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, temperature } : l)));
    setSelectedIds(new Set());
    toast({
      title: `Aktualizovaných ${ids.length} leadov`,
      description: `Teplota: ${temperature ?? "vyčistené"}`,
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Naozaj vymazať ${ids.length} leadov? Túto akciu nie je možné vrátiť.`)) return;
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) {
      toast({ title: "Vymazanie zlyhalo", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelectedIds(new Set());
    toast({ title: `Vymazaných ${ids.length} leadov` });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Vymazanie zlyhalo", description: error.message, variant: "destructive" });
    } else {
      setLeads((prev) => prev.filter((l) => l.id !== deleteId));
      toast({ title: "Lead vymazaný" });
    }
    setDeleteId(null);
  };

  const handleAddLead = async () => {
    if (!newLead.name.trim() || !newLead.email.trim()) {
      toast({ title: "Chýbajú údaje", description: "Meno a e-mail sú povinné", variant: "destructive" });
      return;
    }
    setAddSaving(true);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: newLead.name.trim(),
        email: newLead.email.trim(),
        phone: newLead.phone.trim() || null,
        source: newLead.source.trim() || null,
        type: newLead.type,
        status: newLead.status,
        assigned_to: newLead.assigned_to || null,
        message: newLead.message.trim() || null,
        notes: newLead.notes.trim() || null,
        language: "sk",
      })
      .select()
      .single();

    setAddSaving(false);
    if (error) {
      toast({ title: "Pridanie zlyhalo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead pridaný" });
      setLeads((prev) => [data as Lead, ...prev]);
      setAddOpen(false);
      setNewLead({ name: "", email: "", phone: "", source: "", type: "ai", status: "new", assigned_to: "", message: "", notes: "" });
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Robust text decode: try UTF-8, fall back to Windows-1250 (Slovak Excel exports)
      const buf = await file.arrayBuffer();
      let text = "";
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("windows-1250").decode(buf);
      }
      // Strip BOM
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      let rows = parseCsv(text);
      if (rows.length < 2) {
        toast({ title: "Prázdny CSV", description: "Súbor neobsahuje žiadne riadky", variant: "destructive" });
        return;
      }

      // Simpler heuristic: header has only 1 cell containing many commas
      if (rows[0].length === 1 && rows[0][0].includes(",")) {
        rows = rows
          .map((r) => {
            let s = r[0] || "";
            if (s.startsWith(",")) s = s.slice(1);
            return parseCsv(s)[0] || [];
          })
          .filter((r) => r.length > 0);
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (names: string[]) => {
        for (const n of names) {
          const i = headers.indexOf(n);
          if (i !== -1) return i;
        }
        return -1;
      };
      const nameIdx = idx(["meno", "name", "full_name"]);
      const emailIdx = idx(["e-mail", "email", "mail"]);
      const phoneIdx = idx(["telefón", "telefon", "phone", "phone_number"]);
      const sourceIdx = idx(["zdroj", "source"]);
      const typeIdx = idx(["typ", "type"]);
      const statusIdx = idx(["status", "stav"]);
      const messageIdx = idx(["správa", "sprava", "message"]);
      const notesIdx = idx(["poznámky", "poznamky", "notes"]);

      if (nameIdx === -1 || emailIdx === -1) {
        toast({
          title: "Chýbajú stĺpce",
          description: `CSV musí obsahovať aspoň 'meno' a 'email'. Nájdené hlavičky: ${headers.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      const typeMap: Record<string, string> = {
        "ai návrh": "ai", "ai navrh": "ai", "ai": "ai",
        "konzultácia": "consultation", "konzultacia": "consultation",
        "re-dizajn": "redesign", "redizajn": "redesign", "redesign": "redesign",
        "eshop": "eshop",
        "ai riešenie": "ai_solution", "ai riesenie": "ai_solution",
        "opravy": "repair", "oprava": "repair",
      };
      const statusMap: Record<string, LeadStatus> = {
        "nový": "new", "novy": "new", "new": "new",
        "zavolať": "to_call", "zavolat": "to_call", "to_call": "to_call",
        "kontaktovaný": "contacted", "kontaktovany": "contacted", "contacted": "contacted",
        "poslať reminder": "reminder", "poslat reminder": "reminder", "reminder": "reminder",
        "dohodnutý": "scheduled", "dohodnuty": "scheduled", "scheduled": "scheduled",
        "zaslať inštrukcie": "send_instructions", "zaslat instrukcie": "send_instructions", "send_instructions": "send_instructions", "instrukcie": "send_instructions",
        "objednávka": "order", "objednavka": "order", "order": "order",
        "zrealizovaný": "won", "zrealizovany": "won", "won": "won",
        "zamietnutý": "lost", "zamietnuty": "lost", "lost": "lost",
      };

      const batchTag = `csv_${new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "")}`;
      const cleanPhone = (p: string) => {
        const t = p.trim();
        if (!t) return null;
        return (t.toLowerCase().startsWith("p:") ? t.slice(2) : t).trim() || null;
      };

      const records = rows
        .slice(1)
        .map((r) => {
          const get = (i: number) => (i >= 0 ? (r[i] || "").trim() : "");
          const rawType = get(typeIdx).toLowerCase();
          const rawStatus = get(statusIdx).toLowerCase();
          const email = get(emailIdx);
          return {
            name: get(nameIdx),
            email,
            phone: cleanPhone(get(phoneIdx) || ""),
            source: get(sourceIdx) || null,
            type: typeMap[rawType] || "ai",
            status: statusMap[rawStatus] || "new",
            message: get(messageIdx) || null,
            notes: get(notesIdx) || null,
            language: "sk",
            imported: true,
            import_batch: batchTag,
          };
        })
        .filter((r) => r.name && r.email && r.email.includes("@"));

      if (records.length === 0) {
        toast({ title: "Žiadne platné riadky", description: "Skontroluj že CSV má stĺpce meno + email s @", variant: "destructive" });
        return;
      }

      // Insert in batches of 200 to avoid timeouts on large imports
      const BATCH = 200;
      let inserted = 0;
      const insertedRows: Lead[] = [];
      for (let i = 0; i < records.length; i += BATCH) {
        const chunk = records.slice(i, i + BATCH);
        const { data, error } = await supabase.from("leads").insert(chunk).select();
        if (error) {
          toast({ title: `Import zlyhal po ${inserted} záznamoch`, description: error.message, variant: "destructive" });
          if (insertedRows.length) setLeads((prev) => [...insertedRows, ...prev]);
          return;
        }
        inserted += data?.length || 0;
        if (data) insertedRows.push(...(data as Lead[]));
      }
      toast({ title: `Importovaných ${inserted} leadov`, description: "Prepni sa na tab 'Importované' pre zobrazenie." });
      setLeads((prev) => [...insertedRows, ...prev]);
      setViewMode("imported");
    } catch (err) {
      toast({
        title: "Chyba čítania súboru",
        description: err instanceof Error ? err.message : "Neznáma chyba",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = useMemo(() => {
    const list = leads.filter((l) => {
      if (viewMode === "imported") {
        if (!l.imported) return false;
      } else {
        if (l.imported) return false;
        if (viewMode === "archive") {
          if (!ARCHIVE_STATUSES.includes(l.status)) return false;
        } else if (viewMode === "stale") {
          if (!isStale(l)) return false;
        } else {
          // current: hide archived statuses and stale leads
          if (ARCHIVE_STATUSES.includes(l.status)) return false;
          if (isStale(l)) return false;
        }
      }
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === UNASSIGNED) {
          if (l.assigned_to) return false;
        } else if (l.assigned_to !== assigneeFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q) ||
          (l.source || "").toLowerCase().includes(q) ||
          (l.assigned_to || "").toLowerCase().includes(q) ||
          (l.message || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    const tempOrder: Record<string, number> = { hot: 0, neutral: 1, cold: 2 };
    const statusOrder: Record<string, number> = {
      new: 0, to_call: 1, contacted: 2, send_offer: 3, offer_silent: 4, reminder: 5, reminder_silent: 6, scheduled: 7, send_instructions: 8, order: 9, won: 10, lost: 11,
    };
    const cmp = (a: Lead, b: Lead): number => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "created_at":
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
          break;
        case "name":
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
          break;
        case "email":
          av = (a.email || "").toLowerCase();
          bv = (b.email || "").toLowerCase();
          break;
        case "source":
          av = (a.source || "").toLowerCase();
          bv = (b.source || "").toLowerCase();
          break;
        case "type":
          av = typeLabel(a.type).toLowerCase();
          bv = typeLabel(b.type).toLowerCase();
          break;
        case "status":
          av = statusOrder[a.status] ?? 99;
          bv = statusOrder[b.status] ?? 99;
          break;
        case "assigned_to":
          av = (a.assigned_to || "zzz").toLowerCase();
          bv = (b.assigned_to || "zzz").toLowerCase();
          break;
        case "temperature":
          av = tempOrder[a.temperature || ""] ?? 99;
          bv = tempOrder[b.temperature || ""] ?? 99;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    return [...list].sort(cmp);
  }, [leads, viewMode, statusFilter, typeFilter, assigneeFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let today = 0, week = 0, month = 0, won = 0, newCount = 0;
    leads.forEach((l) => {
      const t = new Date(l.created_at).getTime();
      if (t >= todayStart) today++;
      if (t >= weekStart) week++;
      if (t >= monthStart) month++;
      if (l.status === "won") won++;
      if (l.status === "new") newCount++;
    });

    return { total: leads.length, today, week, month, won, newCount };
  }, [leads]);

  const exportCsv = () => {
    const headers = [
      "Dátum",
      "Meno",
      "E-mail",
      "Telefón",
      "Zdroj",
      "Typ",
      "Status",
      "Termín",
      "Čas",
      "Správa",
      "Suma (€)",
      "Poznámky",
    ];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toLocaleString("sk-SK"),
      l.name,
      l.email,
      l.phone || "",
      l.source || "",
      typeLabel(l.type),
      STATUS_CONFIG[l.status]?.label || l.status,
      l.consultation_date ? new Date(l.consultation_date).toLocaleDateString("sk-SK") : "",
      l.consultation_time || "",
      (l.message || "").replace(/\n/g, " "),
      l.amount != null ? String(l.amount) : "",
      (l.notes || "").replace(/\n/g, " "),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leady-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            Účet <strong>{userEmail}</strong> nemá pridelenú admin rolu. Kontaktujte správcu.
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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold truncate">
              <span className="text-primary">CRM</span> – Leady
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-2">
            <NotificationBell />
            <Button onClick={() => navigate("/admin/notes")} variant="outline" size="sm">
              <KanbanSquare className="w-4 h-4 mr-2" /> Poznámky
            </Button>
            <Button onClick={() => navigate("/admin/tasks")} variant="outline" size="sm">
              <ListTodo className="w-4 h-4 mr-2" /> TO DO
            </Button>
            <Button onClick={() => navigate("/admin/commissions")} variant="outline" size="sm">
              <Wallet className="w-4 h-4 mr-2" /> Provízie
            </Button>
            <Button onClick={() => navigate("/admin/rentals")} variant="outline" size="sm">
              <Wallet className="w-4 h-4 mr-2" /> Prenájmy
            </Button>
            <Button onClick={() => navigate("/admin/wheel-leads")} variant="outline" size="sm">
              <Sparkles className="w-4 h-4 mr-2" /> Wheel
            </Button>
            <Button onClick={() => navigate("/admin/signatures")} variant="outline" size="sm">
              <FileSignature className="w-4 h-4 mr-2" /> Podpisy
            </Button>
            <Button onClick={() => navigate("/admin/designs")} variant="outline" size="sm">
              <Palette className="w-4 h-4 mr-2" /> Dizajny
            </Button>
            <Button onClick={() => navigate("/admin/logs")} variant="outline" size="sm">
              <History className="w-4 h-4 mr-2" /> Logy
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
            </Button>
          </div>

          {/* Mobile nav */}
          <div className="flex lg:hidden items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Menu">
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                <DropdownMenuItem onClick={() => navigate("/admin/notes")}>
                  <KanbanSquare className="w-4 h-4 mr-2" /> Poznámky
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/tasks")}>
                  <ListTodo className="w-4 h-4 mr-2" /> TO DO
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/commissions")}>
                  <Wallet className="w-4 h-4 mr-2" /> Provízie
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/rentals")}>
                  <Wallet className="w-4 h-4 mr-2" /> Prenájmy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/wheel-leads")}>
                  <Sparkles className="w-4 h-4 mr-2" /> Wheel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/signatures")}>
                  <FileSignature className="w-4 h-4 mr-2" /> Podpisy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/designs")}>
                  <Palette className="w-4 h-4 mr-2" /> Dizajny
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/logs")}>
                  <History className="w-4 h-4 mr-2" /> Logy
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Spolu" value={stats.total} />
          <StatCard icon={CalendarLucide} label="Dnes" value={stats.today} />
          <StatCard icon={TrendingUp} label="7 dní" value={stats.week} />
          <StatCard icon={TrendingUp} label="Tento mesiac" value={stats.month} />
          <StatCard icon={Bot} label="Nové" value={stats.newCount} accent="text-blue-500" />
          <StatCard icon={CheckCircle2} label="Zrealizované" value={stats.won} accent="text-green-500" />
        </section>

        {/* View toggle: current / stale / archive / imported */}
        <section className="flex items-center gap-1 sm:gap-2 border-b border-border pb-2 overflow-x-auto">
          {(() => {
            const nonImported = leads.filter((l) => !l.imported);
            const currentCount = nonImported.filter((l) => !ARCHIVE_STATUSES.includes(l.status) && !isStale(l)).length;
            const staleCount = nonImported.filter((l) => isStale(l)).length;
            const archiveCount = nonImported.filter((l) => ARCHIVE_STATUSES.includes(l.status)).length;
            const importedCount = leads.filter((l) => l.imported).length;
            const tabs: { id: ViewMode; label: string; count: number }[] = [
              { id: "current", label: "Aktuálne", count: currentCount },
              { id: "stale", label: `Bez reakcie (>${STALE_DAYS} dní)`, count: staleCount },
              { id: "archive", label: "Archív (zrealiz./zamiet.)", count: archiveCount },
              { id: "imported", label: "Importované", count: importedCount },
            ];
            return tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setViewMode(t.id)}
                className={cn(
                  "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap",
                  viewMode === t.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className="ml-2 text-[10px] sm:text-xs opacity-70">({t.count})</span>
              </button>
            ));
          })()}
        </section>

        {/* Filters + actions */}
        <LeadsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          onAddLead={() => setAddOpen(true)}
          onBulkOffer={() => setBulkOfferOpen(true)}
          onImportClick={() => fileInputRef.current?.click()}
          onExport={exportCsv}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleCsvImport}
        />

        {/* Today must-do */}
        <TodayMustDoSection
          refreshKey={leads.length}
          onLeadClick={(id) => {
            const lead = leads.find((l) => l.id === id);
            if (lead) openLead(lead);
          }}
        />

        {/* Bulk actions bar */}
        <LeadBulkBar
          count={selectedIds.size}
          statusOptions={(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((k) => ({
            value: k,
            label: STATUS_CONFIG[k].label,
          }))}
          assigneeOptions={ASSIGNEES}
          unassignedSentinel={UNASSIGNED}
          onSetStatus={(v) => bulkSetStatus(v as LeadStatus)}
          onSetAssignee={bulkSetAssignee}
          onSetTemperature={bulkSetTemperature}
          onMoveStale={() => bulkMove("stale")}
          onMoveArchive={() => bulkMove("archive")}
          onDelete={bulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />

        {/* Table */}
        <LeadsTable
          loading={loading}
          leads={filtered}
          selectedIds={selectedIds}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          onToggleAll={(checked) => {
            if (checked) setSelectedIds(new Set(filtered.map((l) => l.id)));
            else setSelectedIds(new Set());
          }}
          onToggleOne={(id, checked) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            });
          }}
          onOpenLead={openLead}
          onSetStatus={setLeadStatus}
          onSetTemperature={setLeadTemperature}
          onRequestDelete={setDeleteId}
        />
      </div>

      {/* Lead detail dialog */}
      <LeadDetailDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        selected={selected}
        saving={saving}
        onSave={handleSave}
        editName={editName} setEditName={setEditName}
        editEmail={editEmail} setEditEmail={setEditEmail}
        editPhone={editPhone} setEditPhone={setEditPhone}
        editType={editType} setEditType={setEditType}
        editStatus={editStatus} setEditStatus={setEditStatus}
        editSource={editSource} setEditSource={setEditSource}
        editAssigned={editAssigned} setEditAssigned={setEditAssigned}
        editTemperature={editTemperature} setEditTemperature={setEditTemperature}
        editAmount={editAmount} setEditAmount={setEditAmount}
        editConsultDate={editConsultDate} setEditConsultDate={setEditConsultDate}
        editConsultTime={editConsultTime} setEditConsultTime={setEditConsultTime}
        editFollowUpDate={editFollowUpDate} setEditFollowUpDate={setEditFollowUpDate}
        editCreatedAt={editCreatedAt} setEditCreatedAt={setEditCreatedAt}
        editNotes={editNotes} setEditNotes={setEditNotes}
      />

      {/* Add lead dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nový lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-name">Meno *</Label>
                <Input
                  id="new-name"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="Ján Novák"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">E-mail *</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  placeholder="jan@example.sk"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-phone">Telefón</Label>
                <Input
                  id="new-phone"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="+421..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-source">Zdroj</Label>
                <Input
                  id="new-source"
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  placeholder="Google, FB, odporúčanie..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-type">Typ</Label>
                <Select value={newLead.type} onValueChange={(v) => setNewLead({ ...newLead, type: v })}>
                  <SelectTrigger id="new-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-status">Status</Label>
                <Select
                  value={newLead.status}
                  onValueChange={(v) => setNewLead({ ...newLead, status: v as LeadStatus })}
                >
                  <SelectTrigger id="new-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-assigned">Kto rieši</Label>
                <Select
                  value={newLead.assigned_to || UNASSIGNED}
                  onValueChange={(v) => setNewLead({ ...newLead, assigned_to: v === UNASSIGNED ? "" : v })}
                >
                  <SelectTrigger id="new-assigned"><SelectValue placeholder="Nepriradené" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>— Nepriradené —</SelectItem>
                    {ASSIGNEES.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-message">Správa</Label>
              <Textarea
                id="new-message"
                value={newLead.message}
                onChange={(e) => setNewLead({ ...newLead, message: e.target.value })}
                placeholder="Čo klient potrebuje..."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-notes">Interné poznámky</Label>
              <Textarea
                id="new-notes"
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                placeholder="Poznámky..."
                className="min-h-[80px]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Zrušiť</Button>
              <Button onClick={handleAddLead} variant="gradient" disabled={addSaving}>
                {addSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Pridať lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOfferOpen} onOpenChange={setBulkOfferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Poslať ponuku na viacero adries</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Meno (voliteľné, použije sa v oslovení)</Label>
              <Input
                value={bulkOfferName}
                onChange={(e) => setBulkOfferName(e.target.value)}
                placeholder="napr. klient"
              />
            </div>
            <div>
              <Label>E-mailové adresy</Label>
              <Textarea
                value={bulkOfferEmails}
                onChange={(e) => setBulkOfferEmails(e.target.value)}
                placeholder="adresa1@firma.sk, adresa2@firma.sk&#10;adresa3@firma.sk"
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Oddeľ čiarkou, bodkočiarkou, medzerou alebo novým riadkom.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkOfferOpen(false)} disabled={bulkOfferSending}>
                Zrušiť
              </Button>
              <Button onClick={handleBulkOfferSend} disabled={bulkOfferSending} variant="gradient">
                {bulkOfferSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Odoslať
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nevratná. Lead bude trvalo odstránený z databázy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent = "text-primary",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  accent?: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <Icon className={`w-3.5 h-3.5 ${accent}`} />
      {label}
    </div>
    <p className="text-2xl font-bold mt-1">{value}</p>
  </div>
);

export default Admin;
