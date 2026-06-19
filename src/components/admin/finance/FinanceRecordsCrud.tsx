import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminLongTextField } from "@/components/admin/AdminLongTextField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useCrmDraft } from "@/hooks/useCrmDraft";
import { useCrmViewRestore } from "@/hooks/useCrmViewRestore";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { buildDraftKey, clearCrmDraft } from "@/lib/crmPersistence/draftStore";
import { clearCrmViewState } from "@/lib/crmPersistence/viewRestoreStore";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { resolveCustomerIdentity, customerDisplayLabel } from "@/lib/finance/customerBridge";
import {
  FINANCE_ENTITY_KIND_LABELS,
  resolvePaymentRecordOrigin,
  type FinanceEntityKind,
} from "@/lib/finance/financeSourceLabels";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import {
  type FactDraft,
  type FinanceRawContext,
  hasPromotedFactForLegacy,
  prefillFromLegacyRecord,
} from "@/lib/finance/factDrafts";
import { Loader2, Lock, Pencil, Plus, Trash2, CheckCircle2 } from "lucide-react";

type RecordKind = "payment" | "payout" | "cost";

interface FinanceRecordsCrudProps {
  paymentRecords: any[];
  payoutRecords: any[];
  costRecords: any[];
  onSaved: () => void;
}

const todayLocal = () => new Date().toISOString().slice(0, 16);

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
};

const fromLocalInput = (local: string) => {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
};

const isLegacy = (truthLevel: string) => truthLevel === "legacy_import";

type FinanceModalSnapshot = {
  kind: RecordKind;
  editId: string | null;
  readOnly: boolean;
  form: Record<string, string>;
  tab: RecordKind;
};

const emptyFormForKind = (k: RecordKind): Record<string, string> =>
  k === "payment"
    ? { amount: "", paid_at: todayLocal(), method: "", reference: "", customer_email: "", client_name: "", note: "" }
    : k === "payout"
      ? { amount: "", paid_at: todayLocal(), implementer: "", reference: "", note: "" }
      : { amount: "", paid_at: todayLocal(), incurred_at: todayLocal(), category: "", vendor: "", reference: "", note: "" };

const recordParamValue = (k: RecordKind, id: string | null) => `${k}:${id ?? "new"}`;

const parseRecordParam = (value: string | null): { kind: RecordKind; editId: string | null } | null => {
  if (!value) return null;
  const [kindPart, idPart] = value.split(":");
  if (kindPart !== "payment" && kindPart !== "payout" && kindPart !== "cost") return null;
  if (!idPart) return null;
  return { kind: kindPart, editId: idPart === "new" ? null : idPart };
};

const snapshotFromRow = (k: RecordKind, row: Record<string, unknown>): Record<string, string> => {
  if (k === "payment") {
    return {
      amount: String(row.amount ?? ""),
      paid_at: toLocalInput(row.paid_at as string | null),
      method: String(row.method ?? ""),
      reference: String(row.reference ?? ""),
      customer_email: String(row.customer_email ?? ""),
      client_name: String(row.client_name ?? ""),
      note: String(row.note ?? ""),
    };
  }
  if (k === "payout") {
    return {
      amount: String(row.amount ?? ""),
      paid_at: toLocalInput(row.paid_at as string | null),
      implementer: String(row.implementer ?? ""),
      reference: String(row.reference ?? ""),
      note: String(row.note ?? ""),
    };
  }
  return {
    amount: String(row.amount ?? ""),
    paid_at: toLocalInput(row.paid_at as string | null),
    incurred_at: toLocalInput(row.incurred_at as string | null),
    category: String(row.category ?? ""),
    vendor: String(row.vendor ?? ""),
    reference: String(row.reference ?? ""),
    note: String(row.note ?? ""),
  };
};

export function FinanceRecordsCrud({
  paymentRecords,
  payoutRecords,
  costRecords,
  onSaved,
}: FinanceRecordsCrudProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<RecordKind>("payment");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<RecordKind>("payment");
  const [editId, setEditId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [modalBaseline, setModalBaseline] = useState<FinanceModalSnapshot>(() => ({
    kind: "payment",
    editId: null,
    readOnly: false,
    form: emptyFormForKind("payment"),
    tab: "payment",
  }));
  const [promoteDraft, setPromoteDraft] = useState<FactDraft | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [paymentOriginFilter, setPaymentOriginFilter] = useState<FinanceEntityKind | "all">("all");

  const filteredPaymentRecords = useMemo(() => {
    if (paymentOriginFilter === "all") return paymentRecords;
    return paymentRecords.filter(
      (r) => resolvePaymentRecordOrigin(r).entityKind === paymentOriginFilter,
    );
  }, [paymentRecords, paymentOriginFilter]);

  const modalSnapshot = useMemo<FinanceModalSnapshot>(
    () => ({ kind, editId, readOnly, form, tab }),
    [kind, editId, readOnly, form, tab],
  );

  const draftEntityId = `${kind}:${editId ?? "new"}`;

  const { discardDraft: discardFinanceDraft, clearDraft: clearFinanceDraft } = useCrmDraft({
    modalId: "finance-record",
    route: "/admin/finance",
    entityId: draftEntityId,
    isActive: dialogOpen && !readOnly,
    data: modalSnapshot,
    baseline: modalBaseline,
    onRestore: (draft) => {
      const d = draft as FinanceModalSnapshot;
      setKind(d.kind);
      setEditId(d.editId);
      setReadOnly(d.readOnly);
      setForm(d.form);
      setTab(d.tab);
    },
  });

  const closeFinanceDialog = useCallback(() => {
    clearFinanceDraft();
    clearCrmViewState();
    setDialogOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("record");
    setSearchParams(next, { replace: true });
  }, [clearFinanceDraft, searchParams, setSearchParams]);

  const discardFinanceChanges = useCallback(() => {
    discardFinanceDraft();
    clearCrmViewState();
  }, [discardFinanceDraft]);

  const ctx: FinanceRawContext = {
    commissions: [],
    expenses: [],
    websites: [],
    payments: [],
    paymentRecords,
    payoutRecords,
    costRecords,
  };

  const openPromote = (k: RecordKind, row: any) => {
    const draft = prefillFromLegacyRecord(k, row);
    setPromoteDraft(draft);
    setPromoteOpen(true);
  };

  const canPromote = (k: RecordKind, row: any) =>
    isLegacy(row.truth_level) && !hasPromotedFactForLegacy(ctx, k, row);

  const findRow = useCallback(
    (k: RecordKind, id: string) => {
      const list = k === "payment" ? paymentRecords : k === "payout" ? payoutRecords : costRecords;
      return list.find((r) => r.id === id);
    },
    [paymentRecords, payoutRecords, costRecords],
  );

  const openCreate = useCallback((k: RecordKind, opts?: { reset?: boolean }) => {
    if (opts?.reset !== false) {
      const blankForm = emptyFormForKind(k);
      setForm(blankForm);
      setModalBaseline({
        kind: k,
        editId: null,
        readOnly: false,
        form: blankForm,
        tab: k,
      });
    }
    setKind(k);
    setEditId(null);
    setReadOnly(false);
    setTab(k);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((k: RecordKind, row: Record<string, unknown>) => {
    const legacy = isLegacy(String(row.truth_level ?? ""));
    const rowForm = snapshotFromRow(k, row);
    const baseline: FinanceModalSnapshot = {
      kind: k,
      editId: String(row.id),
      readOnly: legacy,
      form: rowForm,
      tab: k,
    };
    setKind(k);
    setEditId(String(row.id));
    setReadOnly(legacy);
    setForm(rowForm);
    setTab(k);
    setModalBaseline(baseline);
    setDialogOpen(true);
  }, []);

  useCrmViewRestore({
    route: "/admin/finance",
    modalId: "finance-record",
    entityId: dialogOpen ? draftEntityId : null,
    section: tab,
    isModalOpen: dialogOpen,
    query: dialogOpen ? { record: recordParamValue(kind, editId) } : undefined,
    onRestore: (state) => {
      if (dialogOpen || state.modalId !== "finance-record" || !state.entityId) return;
      const parsed = parseRecordParam(state.query?.record ?? state.entityId);
      if (!parsed) return;
      if (state.section === "payment" || state.section === "payout" || state.section === "cost") {
        setTab(state.section);
      }
      if (parsed.editId) {
        const row = findRow(parsed.kind, parsed.editId);
        if (row) openEdit(parsed.kind, row);
        else clearCrmViewState();
        return;
      }
      openCreate(parsed.kind, { reset: false });
    },
  });

  useEffect(() => {
    const param = searchParams.get("record");
    const parsed = parseRecordParam(param);
    if (!parsed) return;
    if (dialogOpen && kind === parsed.kind && editId === parsed.editId) return;
    if (parsed.editId) {
      const row = findRow(parsed.kind, parsed.editId);
      if (row) {
        openEdit(parsed.kind, row);
        return;
      }
      clearCrmDraft(buildDraftKey("finance-record", `${parsed.kind}:${parsed.editId}`));
      clearCrmViewState();
      const next = new URLSearchParams(searchParams);
      next.delete("record");
      setSearchParams(next, { replace: true });
      return;
    }
    if (!dialogOpen) openCreate(parsed.kind, { reset: false });
  }, [searchParams, dialogOpen, kind, editId, findRow, openEdit, openCreate, setSearchParams]);

  useEffect(() => {
    if (!dialogOpen) return;
    const value = recordParamValue(kind, editId);
    const next = new URLSearchParams(searchParams);
    if (next.get("record") === value) return;
    next.set("record", value);
    setSearchParams(next, { replace: true });
  }, [dialogOpen, kind, editId, searchParams, setSearchParams]);

  const openCreateFresh = (k: RecordKind) => openCreate(k, { reset: true });
  const save = async (): Promise<boolean> => {
    if (readOnly) return true;
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Neplatná suma", variant: "destructive" });
      return false;
    }
    setSaving(true);
    try {
      if (kind === "payment") {
        const payload = {
          amount,
          paid_at: fromLocalInput(form.paid_at),
          method: form.method || null,
          reference: form.reference || null,
          customer_email: form.customer_email || null,
          client_name: form.client_name || null,
          note: form.note || null,
          currency: "EUR",
        };
        if (editId && !readOnly) {
          const { error } = await supabase.from("payment_records").update(payload).eq("id", editId);
          if (error) throw error;
        } else if (!editId) {
          const { error } = await supabase
            .from("payment_records")
            .insert({ ...payload, truth_level: "payment_fact" });
          if (error) throw error;
        }
      } else if (kind === "payout") {
        const payload = {
          amount,
          paid_at: fromLocalInput(form.paid_at),
          implementer: form.implementer || null,
          reference: form.reference || null,
          note: form.note || null,
          currency: "EUR",
        };
        if (editId && !readOnly) {
          const { error } = await supabase.from("payout_records").update(payload).eq("id", editId);
          if (error) throw error;
        } else if (!editId) {
          const { error } = await supabase
            .from("payout_records")
            .insert({ ...payload, truth_level: "payout_fact" });
          if (error) throw error;
        }
      } else {
        const paidAt = form.paid_at ? fromLocalInput(form.paid_at) : null;
        const incurredAt = form.incurred_at ? fromLocalInput(form.incurred_at) : null;
        if (!paidAt && !incurredAt) {
          toast({ title: "Zadajte paid_at alebo incurred_at", variant: "destructive" });
          setSaving(false);
          return false;
        }
        const payload = {
          amount,
          paid_at: paidAt,
          incurred_at: incurredAt,
          category: form.category || null,
          vendor: form.vendor || null,
          reference: form.reference || null,
          note: form.note || null,
          currency: "EUR",
        };
        if (editId && !readOnly) {
          const { error } = await supabase.from("cost_records").update(payload).eq("id", editId);
          if (error) throw error;
        } else if (!editId) {
          const { error } = await supabase
            .from("cost_records")
            .insert({ ...payload, truth_level: "cost_fact" });
          if (error) throw error;
        }
      }
      toast({ title: editId ? "Uložené" : "Vytvorené" });
      discardFinanceDraft();
      clearCrmViewState();
      closeFinanceDialog();
      onSaved();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Neznáma chyba";
      toast({ title: "Chyba", description: message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const financeCloseGuard = useAdminCloseGuard({
    isOpen: dialogOpen && !readOnly,
    current: modalSnapshot,
    onSave: save,
    onDiscard: discardFinanceChanges,
    saving,
  });

  const requestCloseFinance = () => {
    if (readOnly) {
      closeFinanceDialog();
      return;
    }
    financeCloseGuard.requestClose(closeFinanceDialog);
  };

  const remove = async (k: RecordKind, id: string, truthLevel: string) => {
    if (isLegacy(truthLevel)) {
      toast({
        title: "Legacy import nie je zmazaný",
        description: "Vytvorte nový potvrdený záznam namiesto mazania legacy dát.",
      });
      return;
    }
    if (!window.confirm("Zmazať potvrdený záznam?")) return;
    const table =
      k === "payment" ? "payment_records" : k === "payout" ? "payout_records" : "cost_records";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Zmazané" });
    onSaved();
  };

  const truthBadge = (tl: string) => <TruthLevelBadge level={tl} />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Nové záznamy = potvrdené fakty. Legacy import je read-only — pre opravu vytvorte nový potvrdený záznam.
      </p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as RecordKind)}>
        <TabsList>
          <TabsTrigger value="payment">Platby ({paymentRecords.length})</TabsTrigger>
          <TabsTrigger value="payout">Výplaty ({payoutRecords.length})</TabsTrigger>
          <TabsTrigger value="cost">Náklady ({costRecords.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="payment" className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={paymentOriginFilter === "all" ? "default" : "outline"}
                className="h-7 text-[10px]"
                onClick={() => setPaymentOriginFilter("all")}
              >
                Všetky ({paymentRecords.length})
              </Button>
              {(
                ["hosting", "project", "task", "marketing", "rental", "other"] as FinanceEntityKind[]
              ).map((kind) => {
                const count = paymentRecords.filter(
                  (r) => resolvePaymentRecordOrigin(r).entityKind === kind,
                ).length;
                if (count === 0) return null;
                return (
                  <Button
                    key={kind}
                    size="sm"
                    variant={paymentOriginFilter === kind ? "default" : "outline"}
                    className="h-7 text-[10px]"
                    onClick={() => setPaymentOriginFilter(kind)}
                  >
                    {FINANCE_ENTITY_KIND_LABELS[kind]} ({count})
                  </Button>
                );
              })}
            </div>
            <Button size="sm" onClick={() => openCreateFresh("payment")}>
              <Plus className="w-4 h-4 mr-1" /> Nová platba
            </Button>
          </div>
          <RecordsTable
            rows={filteredPaymentRecords}
            columns={["Dátum", "Zdroj entity", "Klient", "Suma", "Ref.", "Truth", ""]}
            renderRow={(r) => {
              const origin = resolvePaymentRecordOrigin(r);
              return (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.paid_at?.slice(0, 10)}</TableCell>
                <TableCell className="text-xs">
                  <span className="font-medium">{origin.entityLabel ?? "—"}</span>
                  {origin.sublabel && (
                    <span className="block text-[10px] text-muted-foreground">{origin.sublabel}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {customerDisplayLabel(
                    resolveCustomerIdentity({
                      customerEmail: r.customer_email,
                      clientName: r.client_name,
                    }),
                  )}
                </TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)} €</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
                <TableCell>{truthBadge(r.truth_level)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canPromote("payment", r) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Potvrdiť ako fact" onClick={() => openPromote("payment", r)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit("payment", r)}>
                    {isLegacy(r.truth_level) ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </Button>
                  {!isLegacy(r.truth_level) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove("payment", r.id, r.truth_level)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
            }}
          />
        </TabsContent>

        <TabsContent value="payout" className="mt-3">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => openCreateFresh("payout")}>
              <Plus className="w-4 h-4 mr-1" /> Nová výplata
            </Button>
          </div>
          <RecordsTable
            rows={payoutRecords}
            columns={["Dátum", "Implementér", "Suma", "Ref.", "Truth", ""]}
            renderRow={(r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.paid_at?.slice(0, 10)}</TableCell>
                <TableCell className="text-sm">{r.implementer ?? "—"}</TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)} €</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
                <TableCell>{truthBadge(r.truth_level)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canPromote("payout", r) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Potvrdiť ako fact" onClick={() => openPromote("payout", r)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit("payout", r)}>
                    {isLegacy(r.truth_level) ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </Button>
                  {!isLegacy(r.truth_level) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove("payout", r.id, r.truth_level)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="cost" className="mt-3">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => openCreateFresh("cost")}>
              <Plus className="w-4 h-4 mr-1" /> Nový náklad
            </Button>
          </div>
          <RecordsTable
            rows={costRecords}
            columns={["Dátum", "Kategória", "Suma", "Ref.", "Truth", ""]}
            renderRow={(r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{(r.paid_at ?? r.incurred_at)?.slice(0, 10) ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.category ?? r.vendor ?? "—"}</TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)} €</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
                <TableCell>{truthBadge(r.truth_level)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canPromote("cost", r) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Potvrdiť ako fact" onClick={() => openPromote("cost", r)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit("cost", r)}>
                    {isLegacy(r.truth_level) ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </Button>
                  {!isLegacy(r.truth_level) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove("cost", r.id, r.truth_level)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
      </Tabs>

      {financeCloseGuard.closeGuardDialog}

      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            if (readOnly) closeFinanceDialog();
            else financeCloseGuard.handleOpenChange(o, closeFinanceDialog);
          }
        }}
        size="md"
        stickyFooter={!readOnly}
        title={
          readOnly
            ? "Legacy import (read-only)"
            : editId
              ? "Upraviť potvrdený záznam"
              : kind === "payment"
                ? "Nová potvrdená platba"
                : kind === "payout"
                  ? "Nová potvrdená výplata"
                  : "Nový potvrdený náklad"
        }
        footer={
          <>
            <Button variant="outline" onClick={requestCloseFinance}>
              {readOnly ? "Zavrieť" : "Zrušiť"}
            </Button>
            {!readOnly && (
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Uložiť
              </Button>
            )}
          </>
        }
      >
          {readOnly && (
            <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30 mb-3">
              Legacy import nie je editovateľný. Pre korekciu vytvorte nový záznam s truth_level=fact.
            </p>
          )}
          <div className="space-y-3">
            <Field label="Suma (€)">
              <Input type="number" step="0.01" value={form.amount} disabled={readOnly} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            {kind === "payment" && (
              <>
                <Field label="Dátum platby">
                  <Input type="datetime-local" value={form.paid_at} disabled={readOnly} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
                </Field>
                <Field label="Metóda">
                  <Input value={form.method} disabled={readOnly} onChange={(e) => setForm({ ...form, method: e.target.value })} />
                </Field>
                <Field label="Referencia">
                  <Input value={form.reference} disabled={readOnly} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
                <Field label="Email zákazníka">
                  <Input value={form.customer_email} disabled={readOnly} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                </Field>
                <Field label="Klient">
                  <Input value={form.client_name} disabled={readOnly} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </Field>
              </>
            )}
            {kind === "payout" && (
              <>
                <Field label="Dátum výplaty">
                  <Input type="datetime-local" value={form.paid_at} disabled={readOnly} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
                </Field>
                <Field label="Implementér">
                  <Input value={form.implementer} disabled={readOnly} onChange={(e) => setForm({ ...form, implementer: e.target.value })} />
                </Field>
                <Field label="Referencia">
                  <Input value={form.reference} disabled={readOnly} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
              </>
            )}
            {kind === "cost" && (
              <>
                <Field label="Dátum úhrady">
                  <Input type="datetime-local" value={form.paid_at} disabled={readOnly} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
                </Field>
                <Field label="Dátum vzniku">
                  <Input type="datetime-local" value={form.incurred_at} disabled={readOnly} onChange={(e) => setForm({ ...form, incurred_at: e.target.value })} />
                </Field>
                <Field label="Kategória">
                  <Input value={form.category} disabled={readOnly} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </Field>
                <Field label="Dodávateľ">
                  <Input value={form.vendor} disabled={readOnly} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </Field>
                <Field label="Referencia">
                  <Input value={form.reference} disabled={readOnly} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
              </>
            )}
            <AdminLongTextField
              label="Poznámka"
              value={form.note ?? ""}
              onChange={(note) => setForm({ ...form, note })}
              withDatePrefix={false}
            />
          </div>
      </AdminDialog>

      <FactConfirmDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        draft={promoteDraft}
        mode="promote"
        onSaved={onSaved}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function RecordsTable({
  rows,
  columns,
  renderRow,
}: {
  rows: any[];
  columns: string[];
  renderRow: (row: any) => ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Žiadne záznamy</div>;
  }
  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
