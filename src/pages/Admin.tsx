/** governance:inline-queries — do not expand; extract loaders to src/lib/ in Plan Mode (GOVERNANCE.md). */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LeadBulkBar from "@/components/admin/leads/LeadBulkBar";
import LeadsToolbar from "@/components/admin/leads/LeadsToolbar";
import LeadsTable from "@/components/admin/leads/LeadsTable";
import LeadDetailDialog from "@/components/admin/leads/LeadDetailDialog";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminLongTextField } from "@/components/admin/AdminLongTextField";
import { useCrmDraft } from "@/hooks/useCrmDraft";
import { useCrmViewRestore } from "@/hooks/useCrmViewRestore";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import {
  applyLeadFormDraft,
  leadToFormDraft,
  snapshotLeadFormState,
  type LeadFormDraft,
} from "@/lib/crmPersistence/leadFormDraft";
import {
  buildDraftKey,
  clearCrmDraft,
} from "@/lib/crmPersistence/draftStore";
import { clearCrmViewState } from "@/lib/crmPersistence/viewRestoreStore";
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
  TYPE_OPTIONS,
} from "@/components/admin/leads/constants";
import {
  getLeadStatusEmailToast,
  runLeadStatusSideEffects,
} from "@/components/admin/leads/leadStatusSideEffects";
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
import { useDestructiveAction } from "@/hooks/useDestructiveAction";
import { logAdminAuditEvent } from "@/lib/audit/auditLog";
import { bulkDeleteLeads, formatBulkLeadDeleteSummary } from "@/lib/destructive/bulkLeadDelete";
import { LEAD_DELETE_BULK_SUMMARY } from "@/lib/leads/destructive";
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
  Sun,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useAccessContext } from "@/hooks/useAccessContext";
import { canAccessOperationalCrm, isCrmUser } from "@/lib/rbac/permissions";
import { filterLeadsForUser } from "@/lib/rbac/scopeHelpers";
import {
  ensureLeadCustomerLink,
  prepareLeadCustomerForSave,
  validateLeadCustomerBeforeSave,
  shouldRequireLeadCustomer,
} from "@/lib/crmLookup/leadCustomerLifecycle";

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
  const { authChecking, isAdmin, isCrmUser, role, userEmail, userId } = useAdminAccess();
  const accessCtx = useAccessContext();
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
  const [leadBaseline, setLeadBaseline] = useState<LeadFormDraft | null>(null);
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
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [leadCustomerError, setLeadCustomerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingDeleteLeadId = useRef<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({
    onSuccess: () => {
      const id = pendingDeleteLeadId.current;
      if (!id) return;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelected((cur) => (cur?.id === id ? null : cur));
      pendingDeleteLeadId.current = null;
    },
  });

  const handleRequestDeleteLead = useCallback(
    (id: string) => {
      const lead = leads.find((l) => l.id === id);
      pendingDeleteLeadId.current = id;
      void requestDelete({
        entityType: "lead",
        entityId: id,
        entityLabel: lead?.name?.trim() || lead?.email?.trim() || undefined,
      });
    },
    [leads, requestDelete],
  );

  // Bulk send offer dialog (emails from selected leads)
  const [bulkOfferOpen, setBulkOfferOpen] = useState(false);
  const [bulkOfferName, setBulkOfferName] = useState("");
  const [bulkOfferSending, setBulkOfferSending] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  const handleBulkOfferSend = async () => {
    const selectedLeads = leads.filter((l) => selectedIds.has(l.id));
    const list = [
      ...new Map(
        selectedLeads
          .map((l) => l.email?.trim())
          .filter((e): e is string => !!e && e.includes("@"))
          .map((e) => [e.toLowerCase(), e] as const),
      ).values(),
    ];
    if (list.length === 0) {
      toast({
        title: "Žiadne platné e-maily",
        description: "Vo výbere nie sú leady s použiteľnou e-mailovou adresou.",
        variant: "destructive",
      });
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
        setBulkOfferName("");
        setSelectedIds(new Set());
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

  const openBulkOffer = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Žiadny výber",
        description: "Vyberte leady v tabuľke checkboxmi, potom odošlite ponuku.",
        variant: "destructive",
      });
      return;
    }
    setBulkOfferOpen(true);
  };

  // Manual add dialog state
  const emptyNewLead = () => ({
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
  type NewLeadForm = ReturnType<typeof emptyNewLead>;

  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [newLead, setNewLead] = useState<NewLeadForm>(emptyNewLead);
  const [newLeadBaseline, setNewLeadBaseline] = useState<NewLeadForm>(emptyNewLead);

  const openAddLead = useCallback((opts?: { reset?: boolean }) => {
    if (opts?.reset !== false) {
      const blank = emptyNewLead();
      setNewLeadBaseline(blank);
      setNewLead(blank);
    }
    setSelected(null);
    setLeadBaseline(null);
    setAddOpen(true);
  }, []);

  const { discardDraft: discardAddLeadDraft, clearDraft: clearAddLeadDraft } = useCrmDraft({
    modalId: "lead-create",
    route: "/admin",
    entityId: "new",
    isActive: addOpen,
    data: newLead,
    baseline: newLeadBaseline,
    onRestore: (draft) => setNewLead(draft as NewLeadForm),
  });

  const closeAddLeadDialog = useCallback(() => {
    clearAddLeadDraft();
    clearCrmViewState();
    setAddOpen(false);
    const next = new URLSearchParams(searchParams);
    if (next.get("lead") === "new") next.delete("lead");
    setSearchParams(next, { replace: true });
  }, [clearAddLeadDraft, searchParams, setSearchParams]);

  const discardAddLeadChanges = useCallback(() => {
    discardAddLeadDraft();
    clearCrmViewState();
  }, [discardAddLeadDraft]);

  useCrmViewRestore({
    route: "/admin",
    modalId: "lead-create",
    entityId: addOpen ? "new" : null,
    isModalOpen: addOpen,
    query: addOpen ? { lead: "new" } : undefined,
    enabled: !loading && !!userId,
    onRestore: (state) => {
      if (addOpen || selected || state.modalId !== "lead-create") return;
      openAddLead({ reset: false });
    },
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

    if (canAccessOperationalCrm(role)) {
      void loadLeads();
      return;
    }

    setLoading(false);
  }, [authChecking, role, navigate, userId]);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Chyba načítania", description: error.message, variant: "destructive" });
    } else {
      setLeads(filterLeadsForUser((data || []) as Lead[], accessCtx));
    }
    setLoading(false);
  };

  const handleSignOut = () => confirmAdminSignOut(navigate);

  const leadFormSetters = useMemo(
    () => ({
      setEditNotes,
      setEditStatus,
      setEditType,
      setEditSource,
      setEditName,
      setEditEmail,
      setEditPhone,
      setEditTemperature,
      setEditAssigned,
      setEditAmount,
      setEditConsultDate,
      setEditConsultTime,
      setEditFollowUpDate,
      setEditCreatedAt,
      setEditCustomerId,
    }),
    [],
  );

  const openLead = useCallback(
    (lead: Lead) => {
      setAddOpen(false);
      const baseline = leadToFormDraft(lead);
      applyLeadFormDraft(baseline, leadFormSetters);
      setLeadBaseline(baseline);
      setSelected(lead);
      setLeadCustomerError(null);
    },
    [leadFormSetters],
  );

  const leadFormSnapshot = useMemo(
    () =>
      snapshotLeadFormState({
        editNotes,
        editStatus,
        editType,
        editSource,
        editName,
        editEmail,
        editPhone,
        editTemperature,
        editAssigned,
        editAmount,
        editConsultDate,
        editConsultTime,
        editFollowUpDate,
        editCreatedAt,
        editCustomerId,
      }),
    [
      editNotes,
      editStatus,
      editType,
      editSource,
      editName,
      editEmail,
      editPhone,
      editTemperature,
      editAssigned,
      editAmount,
      editConsultDate,
      editConsultTime,
      editFollowUpDate,
      editCreatedAt,
      editCustomerId,
    ],
  );

  const applyLeadDraft = useCallback(
    (draft: LeadFormDraft) => applyLeadFormDraft(draft, leadFormSetters),
    [leadFormSetters],
  );

  const { discardDraft: discardLeadDraft, clearDraft: clearLeadDraft } = useCrmDraft({
    modalId: "lead-detail",
    route: "/admin",
    entityId: selected?.id ?? "new",
    isActive: !!selected,
    data: leadFormSnapshot,
    baseline: leadBaseline,
    onRestore: applyLeadDraft,
  });

  const closeLeadModal = useCallback(() => {
    if (selected?.id) clearLeadDraft();
    clearCrmViewState();
    setLeadCustomerError(null);
    setSelected(null);
    setLeadBaseline(null);
    const next = new URLSearchParams(searchParams);
    next.delete("lead");
    setSearchParams(next, { replace: true });
  }, [clearLeadDraft, searchParams, selected?.id, setSearchParams]);

  const discardLeadChanges = useCallback(() => {
    discardLeadDraft();
    clearCrmViewState();
  }, [discardLeadDraft]);

  useCrmViewRestore({
    route: "/admin",
    modalId: "lead-detail",
    entityId: selected?.id ?? null,
    isModalOpen: !!selected,
    query: selected ? { lead: selected.id } : undefined,
    enabled: !loading && !!userId,
    onRestore: (state) => {
      if (selected || !state.entityId || state.modalId !== "lead-detail") return;
      const target = leads.find((l) => l.id === state.entityId);
      if (target) openLead(target);
      else clearCrmViewState();
    },
  });

  // Open lead from ?lead=<id|new> (deep link + restore)
  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (!leadId) return;
    if (leadId === "new") {
      if (!addOpen && !selected) openAddLead({ reset: false });
      return;
    }
    if (leads.length === 0) return;
    if (selected?.id === leadId) return;
    const target = leads.find((l) => l.id === leadId);
    if (target) {
      openLead(target);
      return;
    }
    clearCrmDraft(buildDraftKey("lead-detail", leadId));
    clearCrmViewState();
    const next = new URLSearchParams(searchParams);
    next.delete("lead");
    setSearchParams(next, { replace: true });
  }, [searchParams, leads, selected?.id, addOpen, openLead, openAddLead, setSearchParams]);

  // Keep ?lead= while detail modal is open (tab restore)
  useEffect(() => {
    if (!selected) return;
    const next = new URLSearchParams(searchParams);
    if (next.get("lead") === selected.id) return;
    next.set("lead", selected.id);
    setSearchParams(next, { replace: true });
  }, [selected, searchParams, setSearchParams]);

  // Keep ?lead=new while add dialog is open
  useEffect(() => {
    if (!addOpen || selected) return;
    const next = new URLSearchParams(searchParams);
    if (next.get("lead") === "new") return;
    next.set("lead", "new");
    setSearchParams(next, { replace: true });
  }, [addOpen, selected, searchParams, setSearchParams]);

  const handleSave = async (): Promise<boolean> => {
    if (!selected) return true;
    if (!editName.trim() || !editEmail.trim()) {
      toast({ title: "Chýbajú údaje", description: "Meno a e-mail sú povinné", variant: "destructive" });
      return false;
    }
    setSaving(true);
    const parsedAmount = editAmount.trim() === "" ? null : Number(editAmount.replace(",", "."));
    if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
      setSaving(false);
      toast({ title: "Neplatná suma", description: "Zadaj číselnú hodnotu", variant: "destructive" });
      return false;
    }

    const prepared = await prepareLeadCustomerForSave({
      leadId: selected.id,
      status: editStatus,
      email: editEmail.trim(),
      name: editName.trim(),
      customer_id: editCustomerId ?? selected.customer_id,
    });
    if (!prepared.ok) {
      setLeadCustomerError(prepared.message);
      toast({ title: prepared.message, variant: "destructive" });
      setSaving(false);
      return false;
    }

    const resolvedCustomerId = prepared.customer_id ?? editCustomerId ?? selected.customer_id ?? null;

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
        customer_id: resolvedCustomerId,
      })
      .eq("id", selected.id);

    if (error) {
      setSaving(false);
      toast({ title: "Uloženie zlyhalo", description: error.message, variant: "destructive" });
      return false;
    }

    const linkResult = await ensureLeadCustomerLink({
      leadId: selected.id,
      email: editEmail.trim(),
      name: editName.trim(),
      status: editStatus,
      existingCustomerId: resolvedCustomerId,
    });
    const linkedCustomerId = linkResult.customer_id ?? resolvedCustomerId;

    if (linkResult.reason === "created_customer" || linkResult.reason === "promoted") {
      toast({
        title: "Lead prepojený na klienta",
        description: "Zrealizovaný lead bol automaticky prepojený na kanonického klienta.",
      });
    }

    const emailResult = await runLeadStatusSideEffects(selected.status, editStatus, {
      name: editName.trim(),
      email: editEmail.trim(),
      amount: parsedAmount,
      lead_id: selected.id,
    });

    if (emailResult.action === "skipped") {
      if (linkResult.reason !== "created_customer" && linkResult.reason !== "promoted") {
        toast({ title: "Uložené" });
      }
    } else if (emailResult.action === "sent") {
      toast(getLeadStatusEmailToast("detail", emailResult.kind, "sent", editEmail.trim()));
    } else {
      toast(
        getLeadStatusEmailToast(
          "detail",
          emailResult.kind,
          "failed",
          editEmail.trim(),
          emailResult.error,
        ),
      );
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
              customer_id: linkedCustomerId,
            }
          : l
      )
    );
    setLeadCustomerError(null);
    discardLeadDraft();
    clearCrmViewState();
    closeLeadModal();
    setSaving(false);
    return true;
  };

  const leadCloseGuard = useAdminCloseGuard({
    isOpen: !!selected,
    current: leadFormSnapshot,
    onSave: handleSave,
    onDiscard: discardLeadChanges,
    saving,
  });

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

    const prepared = await prepareLeadCustomerForSave({
      leadId: lead.id,
      status,
      email: lead.email,
      name: lead.name,
      customer_id: lead.customer_id,
    });
    if (!prepared.ok) {
      toast({ title: prepared.message, variant: "destructive" });
      return;
    }

    const resolvedCustomerId = prepared.customer_id ?? lead.customer_id ?? null;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("leads")
      .update({ status, customer_id: resolvedCustomerId, status_changed_at: nowIso })
      .eq("id", lead.id);
    if (error) {
      toast({ title: "Zmena zlyhala", description: error.message, variant: "destructive" });
      return;
    }

    const emailResult = await runLeadStatusSideEffects(lead.status, status, {
      name: lead.name,
      email: lead.email,
      amount: lead.amount ?? null,
      lead_id: lead.id,
    });
    if (emailResult.action === "sent") {
      toast(getLeadStatusEmailToast("inline", emailResult.kind, "sent", lead.email));
    } else if (emailResult.action === "failed") {
      toast(
        getLeadStatusEmailToast(
          "inline",
          emailResult.kind,
          "failed",
          lead.email,
          emailResult.error,
        ),
      );
    }

    const linkResult = await ensureLeadCustomerLink({
      leadId: lead.id,
      email: lead.email,
      name: lead.name,
      status,
      existingCustomerId: resolvedCustomerId,
    });
    const linkedCustomerId = linkResult.customer_id ?? resolvedCustomerId;

    setLeads((ls) =>
      ls.map((l) =>
        l.id === lead.id
          ? { ...l, status, status_changed_at: nowIso, customer_id: linkedCustomerId }
          : l,
      ),
    );
    if (linkResult.reason === "created_customer" || linkResult.reason === "promoted") {
      toast({
        title: "Lead prepojený na klienta",
        description: `${lead.name} · ${lead.email}`,
      });
    }
  };

  const bulkMove = async (target: "stale" | "archive") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Status-only move (lost / reminder_silent) — no email side-effects (not in STATUS_CONFIG.sendsEmail).
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

    const selectedLeads = leads.filter((l) => ids.includes(l.id));

    if (shouldRequireLeadCustomer(status)) {
      const invalidCount = selectedLeads.filter(
        (lead) =>
          !validateLeadCustomerBeforeSave({
            status,
            customer_id: lead.customer_id,
            email: lead.email,
          }).ok,
      ).length;
      if (invalidCount > 0) {
        toast({
          title: "Hromadná zmena statusu zlyhala",
          description: `Nemožno hromadne zmeniť status: ${invalidCount} lead(ov) nemá klienta ani platný e-mail. Opravte jednotlivo pred hromadnou zmenou.`,
          variant: "destructive",
        });
        return;
      }
    }

    const { error } = await supabase.from("leads").update({ status }).in("id", ids);
    if (error) {
      toast({ title: "Zmena zlyhala", description: error.message, variant: "destructive" });
      return;
    }

    if (shouldRequireLeadCustomer(status)) {
      for (const lead of selectedLeads) {
        const linkResult = await ensureLeadCustomerLink({
          leadId: lead.id,
          email: lead.email,
          name: lead.name,
          status,
          existingCustomerId: lead.customer_id,
        });
        if (linkResult.customer_id) {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id ? { ...l, status, customer_id: linkResult.customer_id } : l,
            ),
          );
        }
      }
    } else {
      setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, status } : l)));
    }

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

    setBulkDeleteBusy(true);
    const leadLabels = new Map(
      leads.filter((l) => ids.includes(l.id)).map((l) => [l.id, l.name?.trim() || l.email?.trim() || l.id]),
    );

    let result;
    try {
      result = await bulkDeleteLeads(ids);
    } catch {
      setBulkDeleteBusy(false);
      toast({
        title: "Hromadné mazanie zlyhalo",
        description: "Neočakávaná chyba pri mazaní leadov.",
        variant: "destructive",
      });
      return;
    }

    setBulkDeleteBusy(false);
    setBulkDeleteOpen(false);

    const { deleted } = result;

    if (deleted.length > 0) {
      setLeads((prev) => prev.filter((l) => !deleted.includes(l.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      setSelected((cur) => (cur && deleted.includes(cur.id) ? null : cur));

      if (userId) {
        for (const id of deleted) {
          await logAdminAuditEvent({
            actorUserId: userId,
            actionType: "entity_deleted",
            targetType: "lead",
            targetId: id,
            summary: `Zmazaný lead (bulk): ${leadLabels.get(id) ?? id}`,
          });
        }
      }
    }

    const summary = formatBulkLeadDeleteSummary(result);
    if (deleted.length === 0) {
      toast({
        title: "Žiadny lead nebol zmazaný",
        description: summary || "Všetky vybrané leady boli preskočené alebo zlyhali.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Hromadné mazanie dokončené",
        description: summary,
        ...(result.failed.length > 0 ? { variant: "destructive" as const } : {}),
      });
    }

    if (import.meta.env.DEV && (result.skipped.length > 0 || result.failed.length > 0)) {
      console.info("[bulk-lead-delete]", result);
    }
  };

  const handleAddLead = async (): Promise<boolean> => {
    if (!newLead.name.trim() || !newLead.email.trim()) {
      toast({ title: "Chýbajú údaje", description: "Meno a e-mail sú povinné", variant: "destructive" });
      return false;
    }

    if (shouldRequireLeadCustomer(newLead.status)) {
      const validation = validateLeadCustomerBeforeSave({
        status: newLead.status,
        customer_id: null,
        email: newLead.email.trim(),
      });
      if (!validation.ok) {
        toast({ title: validation.message, variant: "destructive" });
        return false;
      }
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
      return false;
    }

    const inserted = data as Lead;

    if (shouldRequireLeadCustomer(newLead.status)) {
      const linkResult = await ensureLeadCustomerLink({
        leadId: inserted.id,
        email: newLead.email.trim(),
        name: newLead.name.trim(),
        status: newLead.status,
        existingCustomerId: null,
      });
      if (linkResult.customer_id) {
        inserted.customer_id = linkResult.customer_id;
      }
      if (linkResult.reason === "created_customer" || linkResult.reason === "promoted") {
        toast({
          title: "Lead pridaný a prepojený na klienta",
          description: `${newLead.name.trim()} · ${newLead.email.trim()}`,
        });
      } else {
        toast({ title: "Lead pridaný" });
      }
    } else {
      toast({ title: "Lead pridaný" });
    }

    setLeads((prev) => [inserted, ...prev]);
    discardAddLeadDraft();
    clearCrmViewState();
    closeAddLeadDialog();
    setNewLead(emptyNewLead());
    setNewLeadBaseline(emptyNewLead());
    return true;
  };

  const addLeadCloseGuard = useAdminCloseGuard({
    isOpen: addOpen,
    current: newLead,
    onSave: handleAddLead,
    onDiscard: discardAddLeadChanges,
    saving: addSaving,
  });

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

  // Reset selection when dataset context changes (predictable bulk UX).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [viewMode, statusFilter, typeFilter, assigneeFilter, search]);

  const bulkOfferSelectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds],
  );

  const bulkOfferEmailsReady = useMemo(
    () =>
      bulkOfferSelectedLeads.filter((l) => {
        const e = l.email?.trim();
        return !!e && e.includes("@");
      }),
    [bulkOfferSelectedLeads],
  );

  const bulkOfferEmailsMissing = useMemo(
    () =>
      bulkOfferSelectedLeads.filter((l) => {
        const e = l.email?.trim();
        return !e || !e.includes("@");
      }),
    [bulkOfferSelectedLeads],
  );

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

  if (!isCrmUser) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Nemáte prístup</h1>
          <p className="text-muted-foreground">
            Účet <strong>{userEmail}</strong> nemá pridelenú rolu admin ani user. Kontaktujte správcu.
          </p>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return (
    <AdminLayout
      title="Leady"
      subtitle="Pipeline — aktuálne leady"
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/today")}>
          <Sun className="w-4 h-4 mr-2" /> Dnes
        </Button>
      }
    >
      <div className="space-y-6">
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
          onAddLead={() => openAddLead({ reset: true })}
          onBulkOffer={openBulkOffer}
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
          onBulkOffer={openBulkOffer}
          onDelete={() => setBulkDeleteOpen(true)}
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
          onRequestDelete={handleRequestDeleteLead}
        />
      </div>

      {leadCloseGuard.closeGuardDialog}
      <LeadDetailDialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) leadCloseGuard.handleOpenChange(o, closeLeadModal);
        }}
        onRequestClose={() => leadCloseGuard.requestClose(closeLeadModal)}
        selected={selected}
        saving={saving}
        onSave={() => void handleSave()}
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
        editCustomerId={editCustomerId}
        setEditCustomerId={setEditCustomerId}
        leadCustomerError={leadCustomerError}
        onClearLeadCustomerError={() => setLeadCustomerError(null)}
      />

      {addLeadCloseGuard.closeGuardDialog}

      <AdminDialog
        open={addOpen}
        onOpenChange={(o) => {
          if (!o) addLeadCloseGuard.handleOpenChange(o, closeAddLeadDialog);
        }}
        size="lg"
        stickyFooter
        title="Nový lead"
        footer={
          <>
            <Button variant="outline" onClick={() => addLeadCloseGuard.requestClose(closeAddLeadDialog)}>
              Zrušiť
            </Button>
            <Button onClick={() => void handleAddLead()} variant="gradient" disabled={addSaving}>
              {addSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Pridať lead
            </Button>
          </>
        }
      >
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
            <AdminLongTextField
              id="new-message"
              label="Správa"
              value={newLead.message}
              onChange={(message) => setNewLead({ ...newLead, message })}
              placeholder="Čo klient potrebuje..."
              withDatePrefix={false}
            />
            <AdminLongTextField
              id="new-notes"
              label="Interné poznámky"
              value={newLead.notes}
              onChange={(notes) => setNewLead({ ...newLead, notes })}
              placeholder="Poznámky..."
            />
          </div>
      </AdminDialog>

      <Dialog open={bulkOfferOpen} onOpenChange={setBulkOfferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Poslať ponuku vybraným leadom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vybraných leadov: <strong>{bulkOfferSelectedLeads.length}</strong>
              {" · "}
              s e-mailom: <strong>{bulkOfferEmailsReady.length}</strong>
              {bulkOfferEmailsMissing.length > 0 && (
                <span className="text-destructive">
                  {" · "}
                  bez e-mailu: {bulkOfferEmailsMissing.length}
                </span>
              )}
            </p>
            {bulkOfferEmailsReady.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">Adresy na odoslanie</p>
                <ul className="text-xs space-y-1">
                  {bulkOfferEmailsReady.map((l) => (
                    <li key={l.id}>
                      <span className="font-medium">{l.name || "—"}</span>
                      <span className="text-muted-foreground"> · {l.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {bulkOfferEmailsMissing.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="font-medium text-destructive mb-1">Preskočené (chýba e-mail)</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {bulkOfferEmailsMissing.map((l) => (
                    <li key={l.id}>{l.name || l.id.slice(0, 8)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <Label>Meno (voliteľné, použije sa v oslovení)</Label>
              <Input
                value={bulkOfferName}
                onChange={(e) => setBulkOfferName(e.target.value)}
                placeholder="napr. klient"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkOfferOpen(false)} disabled={bulkOfferSending}>
                Zrušiť
              </Button>
              <Button
                onClick={handleBulkOfferSend}
                disabled={bulkOfferSending || bulkOfferEmailsReady.length === 0}
                variant="gradient"
              >
                {bulkOfferSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Odoslať ({bulkOfferEmailsReady.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!bulkDeleteBusy) setBulkDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať {selectedIds.size} leadov?</AlertDialogTitle>
            <AlertDialogDescription>{LEAD_DELETE_BULK_SUMMARY}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteBusy}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void bulkDelete();
              }}
              disabled={bulkDeleteBusy}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkDeleteBusy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Mažem…
                </>
              ) : (
                `Vymazať ${selectedIds.size}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DestructiveModal {...modalProps} />
    </AdminLayout>
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
