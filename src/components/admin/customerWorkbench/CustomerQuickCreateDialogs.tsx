import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import { resolveWorkbenchCustomerLink } from "@/lib/customerWorkbench/customerLink";
import { resolveTaskCustomerFields } from "@/lib/crmLookup/taskCustomerLink";
import { parseInsertRowId } from "@/lib/crmLookup/resolveFormCustomerLink";
import type { CustomerWorkbenchContext } from "@/lib/customerWorkbench/types";

export type QuickCreateKind = "task" | "project" | "hosting" | "commission" | "rental";

interface Props {
  ctx: CustomerWorkbenchContext;
  openKind: QuickCreateKind | null;
  onClose: () => void;
  onSaved: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function CustomerContextHint({ ctx }: { ctx: CustomerWorkbenchContext }) {
  return (
    <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-2 py-1.5">
      Klient: <span className="font-medium text-foreground">{ctx.displayName}</span>
      {ctx.emailKey ? ` · ${ctx.emailKey}` : ""}
      {ctx.primaryLeadId ? " · prepojené na lead" : ""}
    </p>
  );
}

export function CustomerQuickCreateDialogs({ ctx, openKind, onClose, onSaved }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [projectTitle, setProjectTitle] = useState("");
  const [hostingProvider, setHostingProvider] = useState("");
  const [commissionTitle, setCommissionTitle] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [rentalName, setRentalName] = useState("");
  const [rentalUrl, setRentalUrl] = useState("");
  const [rentalMonthlyPrice, setRentalMonthlyPrice] = useState("");

  const resetAndClose = () => {
    setTaskTitle("");
    setTaskDueDate("");
    setTaskPriority("normal");
    setProjectTitle("");
    setHostingProvider("");
    setCommissionTitle("");
    setCommissionAmount("");
    setRentalName("");
    setRentalUrl("");
    setRentalMonthlyPrice("");
    onClose();
  };

  const saveTask = async () => {
    if (!taskTitle.trim()) {
      toast({ title: "Zadaj názov úlohy", variant: "destructive" });
      return;
    }
    setSaving(true);
    const linked = await resolveTaskCustomerFields({
      customer_id: ctx.resolvedCustomerId,
      customer_email: ctx.emailKey || null,
      client_name: ctx.clientName,
      lead_id: ctx.primaryLeadId,
    });
    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(),
      client_name: linked.client_name || null,
      lead_id: linked.lead_id,
      customer_id: linked.customer_id,
      status: "todo",
      priority: taskPriority,
      due_date: taskDueDate || null,
      amount: 0,
      deposit: 0,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Úloha vytvorená", description: "Zobrazí sa v záložke Úlohy." });
    resetAndClose();
    onSaved();
  };

  const saveProject = async () => {
    if (!projectTitle.trim()) {
      toast({ title: "Zadaj názov projektu", variant: "destructive" });
      return;
    }
    setSaving(true);
    const linked = await resolveWorkbenchCustomerLink(ctx);
    const { data: saved, error } = await supabase
      .from("project_notes")
      .insert({
        title: projectTitle.trim(),
        client_name: linked.client_name || null,
        customer_email: linked.customer_email,
        customer_id: linked.customer_id,
        lead_id: ctx.primaryLeadId,
        status: "in_progress",
        project_type: "wordpress",
      })
      .select("id")
      .maybeSingle();
    const insertResult = parseInsertRowId(saved, error, "Projekt");
    setSaving(false);
    if (!insertResult.ok) {
      toast({ title: "Projekt sa nepodarilo vytvoriť", description: insertResult.error, variant: "destructive" });
      return;
    }
    logEntityCommunicationEventSafe({
      kind: "project_event",
      title: projectTitle.trim(),
      customer_id: linked.customer_id,
      customer_email: linked.customer_email,
      source_table: "project_notes",
      source_id: insertResult.id,
      idempotency_key: `project_notes:${insertResult.id}:created`,
      metadata: { action: "created" },
    });
    toast({ title: "Projekt vytvorený" });
    resetAndClose();
    onSaved();
    navigate(`/admin/projects/${insertResult.id}`);
  };

  const saveHosting = async () => {
    setSaving(true);
    const linked = await resolveWorkbenchCustomerLink(ctx);
    const { data: saved, error } = await supabase
      .from("hosting_records")
      .insert({
        client_name: linked.client_name || null,
        customer_email: linked.customer_email,
        customer_id: linked.customer_id,
        provider: hostingProvider.trim() || null,
        active: true,
        commissionable: false,
      })
      .select("id")
      .maybeSingle();
    const insertResult = parseInsertRowId(saved, error, "Hosting");
    setSaving(false);
    if (!insertResult.ok) {
      toast({ title: "Hosting sa nepodarilo vytvoriť", description: insertResult.error, variant: "destructive" });
      return;
    }
    logEntityCommunicationEventSafe({
      kind: "hosting_event",
      title: linked.client_name || "Hosting záznam",
      body_preview: hostingProvider || null,
      customer_id: linked.customer_id,
      customer_email: linked.customer_email,
      source_table: "hosting_records",
      source_id: insertResult.id,
      idempotency_key: `hosting_records:${insertResult.id}:created`,
      metadata: { action: "created" },
    });
    toast({ title: "Hosting vytvorený" });
    resetAndClose();
    onSaved();
    navigate(`/admin/hosting/${insertResult.id}`);
  };

  const saveRental = async () => {
    if (!rentalName.trim()) {
      toast({ title: "Zadaj názov webu", variant: "destructive" });
      return;
    }
    setSaving(true);
    const linked = await resolveWorkbenchCustomerLink(ctx);
    const monthlyPrice = parseFloat(rentalMonthlyPrice.replace(",", ".")) || 0;
    const { data: saved, error } = await supabase
      .from("rental_websites")
      .insert({
        name: rentalName.trim(),
        url: rentalUrl.trim() || null,
        client_name: linked.client_name || null,
        customer_id: linked.customer_id,
        monthly_price: monthlyPrice,
        year: new Date().getFullYear(),
        implementers: [],
        credits_used: 0,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    if (saved?.id) {
      logEntityCommunicationEventSafe({
        kind: "rental_event",
        title: rentalName.trim(),
        body_preview: rentalUrl.trim() || `${monthlyPrice} €/mes`,
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
        source_table: "rental_websites",
        source_id: saved.id,
        idempotency_key: `rental_websites:${saved.id}:created`,
        metadata: { action: "created" },
      });
      toast({ title: "Prenájom vytvorený" });
      resetAndClose();
      onSaved();
      navigate("/admin/rentals");
    }
  };

  const saveCommission = async () => {
    if (!commissionTitle.trim()) {
      toast({ title: "Zadaj názov provízie", variant: "destructive" });
      return;
    }
    setSaving(true);
    const linked = await resolveWorkbenchCustomerLink(ctx);
    const amount = parseFloat(commissionAmount.replace(",", ".")) || 0;
    const { data: saved, error } = await supabase
      .from("commissions")
      .insert({
        title: commissionTitle.trim(),
        amount,
        date: todayISO(),
        implementer: "",
        payment_status: "unpaid",
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    if (saved?.id) {
      logEntityCommunicationEventSafe({
        kind: "commission",
        title: commissionTitle.trim(),
        body_preview: `${amount.toFixed(2)} €`,
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
        source_table: "commissions",
        source_id: saved.id,
        idempotency_key: `commissions:${saved.id}:created`,
        metadata: { action: "created", payment_status: "unpaid" },
      });
      toast({ title: "Provízia pridaná" });
      resetAndClose();
      onSaved();
    }
  };

  return (
    <>
      <Dialog open={openKind === "task"} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nová úloha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CustomerContextHint ctx={ctx} />
            <Input
              placeholder="Názov úlohy"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Termín</Label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priorita</Label>
                <Select
                  value={taskPriority}
                  onValueChange={(v) => setTaskPriority(v as typeof taskPriority)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Nízka</SelectItem>
                    <SelectItem value="normal">Normálna</SelectItem>
                    <SelectItem value="high">Vysoká</SelectItem>
                    <SelectItem value="urgent">Urgentné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>
              Zrušiť
            </Button>
            <Button onClick={() => void saveTask()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Vytvoriť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openKind === "project"} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nový projekt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CustomerContextHint ctx={ctx} />
            <Input
              placeholder="Názov projektu"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>
              Zrušiť
            </Button>
            <Button onClick={() => void saveProject()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Vytvoriť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openKind === "rental"} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nový prenájom webu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CustomerContextHint ctx={ctx} />
            <Input
              placeholder="Názov webu"
              value={rentalName}
              onChange={(e) => setRentalName(e.target.value)}
            />
            <Input
              placeholder="URL (voliteľné)"
              value={rentalUrl}
              onChange={(e) => setRentalUrl(e.target.value)}
            />
            <Input
              placeholder="Mesačná cena (€)"
              value={rentalMonthlyPrice}
              onChange={(e) => setRentalMonthlyPrice(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>
              Zrušiť
            </Button>
            <Button onClick={() => void saveRental()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Vytvoriť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openKind === "hosting"} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nový hosting</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CustomerContextHint ctx={ctx} />
            <Input
              placeholder="Poskytovateľ / doména"
              value={hostingProvider}
              onChange={(e) => setHostingProvider(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>
              Zrušiť
            </Button>
            <Button onClick={() => void saveHosting()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Vytvoriť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openKind === "commission"} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nová provízia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CustomerContextHint ctx={ctx} />
            <Input
              placeholder="Názov / popis"
              value={commissionTitle}
              onChange={(e) => setCommissionTitle(e.target.value)}
            />
            <Input
              placeholder="Suma (€)"
              value={commissionAmount}
              onChange={(e) => setCommissionAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>
              Zrušiť
            </Button>
            <Button onClick={() => void saveCommission()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Pridať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
