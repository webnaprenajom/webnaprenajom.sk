import { useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PAYMENT_FORM_OPTIONS, type PaymentFormValue } from "@/lib/paymentForm";
import { customerHrefByClientName } from "@/lib/adminNav";

export type RentalImplementer = {
  name: string;
  percentage: number;
  payment_form?: PaymentFormValue | "";
  note?: string;
};

type RentalWebsite = {
  id: string;
  name: string;
  url: string | null;
  client_name: string | null;
  implementers: RentalImplementer[];
};

type CommissionRow = {
  id: string;
  title: string;
  date: string;
  amount: number;
  payment_status: string;
  note: string | null;
  payment_form: string | null;
  implementer: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  implementerName: string;
  year: number;
  websites: RentalWebsite[];
  commissions: CommissionRow[];
  clientEmailMap: Map<string, string>;
  yearStats: (w: RentalWebsite) => { paid: number; potential: number };
  onSaved: () => void;
}

export function ImplementerCommissionDetailDialog({
  open,
  onOpenChange,
  implementerName,
  year,
  websites,
  commissions,
  clientEmailMap,
  yearStats,
  onSaved,
}: Props) {
  const rentalRows = useMemo(() => {
    const rows: Array<{
      websiteId: string;
      title: string;
      clientName: string | null;
      percentage: number;
      paid: number;
      potential: number;
      payment_form: PaymentFormValue | "";
      note: string;
      impIndex: number;
    }> = [];

    for (const w of websites) {
      const idx = (w.implementers || []).findIndex(
        (i) => i.name.trim().toLowerCase() === implementerName.trim().toLowerCase(),
      );
      if (idx < 0) continue;
      const imp = w.implementers[idx];
      const pct = Number(imp.percentage) || 0;
      if (pct <= 0) continue;
      const stats = yearStats(w);
      rows.push({
        websiteId: w.id,
        title: w.name,
        clientName: w.client_name,
        percentage: pct,
        paid: (stats.paid * pct) / 100,
        potential: (stats.potential * pct) / 100,
        payment_form: (imp.payment_form as PaymentFormValue) || "",
        note: imp.note || "",
        impIndex: idx,
      });
    }
    return rows.sort((a, b) => b.potential - a.potential);
  }, [websites, implementerName, yearStats]);

  const commissionRows = useMemo(() => {
    return commissions
      .filter(
        (c) =>
          c.implementer.trim().toLowerCase() === implementerName.trim().toLowerCase() &&
          c.date.startsWith(String(year)),
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        date: c.date,
        amount: Number(c.amount),
        paid: c.payment_status === "paid" ? Number(c.amount) : 0,
        potential: Number(c.amount),
        payment_form: (c.payment_form as PaymentFormValue) || "",
        note: c.note || "",
        payment_status: c.payment_status,
      }))
      .sort((a, b) => b.potential - a.potential);
  }, [commissions, implementerName, year]);

  const saveRentalRow = async (
    websiteId: string,
    impIndex: number,
    patch: { payment_form?: PaymentFormValue | ""; note?: string },
  ) => {
    const w = websites.find((x) => x.id === websiteId);
    if (!w) return;
    const next = [...(w.implementers || [])];
    next[impIndex] = { ...next[impIndex], ...patch };
    const { error } = await (supabase as any)
      .from("rental_websites")
      .update({ implementers: next })
      .eq("id", websiteId);
    if (error) {
      toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uložené" });
    onSaved();
  };

  const saveCommissionRow = async (
    id: string,
    patch: { payment_form?: PaymentFormValue | ""; note?: string },
  ) => {
    const { error } = await supabase
      .from("commissions")
      .update({
        payment_form: patch.payment_form || null,
        note: patch.note?.trim() || null,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uložené" });
    onSaved();
  };

  const totals = useMemo(() => {
    const rentalPaid = rentalRows.reduce((s, r) => s + r.paid, 0);
    const rentalPot = rentalRows.reduce((s, r) => s + r.potential, 0);
    const commPaid = commissionRows.reduce((s, r) => s + r.paid, 0);
    const commPot = commissionRows.reduce((s, r) => s + r.potential, 0);
    return {
      paid: rentalPaid + commPaid,
      potential: rentalPot + commPot,
      rentalCount: rentalRows.length,
      commissionCount: commissionRows.length,
    };
  }, [rentalRows, commissionRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provízie — {implementerName} ({year})</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Presný zoznam webov (prenájmy) a zákaziek (provízie modul). Suma prenájmov je odvodená z % podielu a stavu mesačných platieb.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Weby</div>
            <div className="font-semibold">{totals.rentalCount}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Zákazky</div>
            <div className="font-semibold">{totals.commissionCount}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Vyplatené</div>
            <div className="font-semibold text-green-600">{totals.paid.toFixed(2)} €</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Potenciál</div>
            <div className="font-semibold text-primary">{totals.potential.toFixed(2)} €</div>
          </div>
        </div>

        {rentalRows.length === 0 && commissionRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Žiadne záznamy pre tohto realizátora.</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Názov</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Vypl.</TableHead>
                  <TableHead className="text-right">Potenc.</TableHead>
                  <TableHead>Forma úhrady</TableHead>
                  <TableHead>Poznámka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalRows.map((r) => (
                  <TableRow key={`rental-${r.websiteId}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">Prenájom</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[140px] truncate">{r.title}</TableCell>
                    <TableCell className="text-xs">
                      {r.clientName ? (
                        customerHrefByClientName(r.clientName, clientEmailMap) ? (
                          <Link
                            to={customerHrefByClientName(r.clientName, clientEmailMap)!}
                            className="text-primary hover:underline"
                          >
                            {r.clientName}
                          </Link>
                        ) : (
                          r.clientName
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.percentage}%</TableCell>
                    <TableCell className="text-right text-xs text-green-600">{r.paid.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-xs">{r.potential.toFixed(2)} €</TableCell>
                    <TableCell>
                      <select
                        className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                        value={r.payment_form}
                        onChange={(e) =>
                          void saveRentalRow(r.websiteId, r.impIndex, {
                            payment_form: e.target.value as PaymentFormValue,
                          })
                        }
                      >
                        <option value="">—</option>
                        {PAYMENT_FORM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs min-w-[120px]"
                        defaultValue={r.note}
                        placeholder="Poznámka"
                        onBlur={(e) => {
                          if (e.target.value !== r.note) {
                            void saveRentalRow(r.websiteId, r.impIndex, { note: e.target.value });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {commissionRows.map((c) => (
                  <TableRow key={`comm-${c.id}`}>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">Zákazka</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[140px] truncate" title={c.title}>
                      {c.title}
                      <div className="text-[10px] text-muted-foreground">{c.date}</div>
                    </TableCell>
                    <TableCell className="text-xs">—</TableCell>
                    <TableCell className="text-right text-xs">—</TableCell>
                    <TableCell className="text-right text-xs text-green-600">{c.paid.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-xs">{c.potential.toFixed(2)} €</TableCell>
                    <TableCell>
                      <select
                        className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                        value={c.payment_form}
                        onChange={(e) =>
                          void saveCommissionRow(c.id, {
                            payment_form: e.target.value as PaymentFormValue,
                          })
                        }
                      >
                        <option value="">—</option>
                        {PAYMENT_FORM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs min-w-[120px]"
                        defaultValue={c.note}
                        placeholder="Poznámka"
                        onBlur={(e) => {
                          if (e.target.value !== c.note) {
                            void saveCommissionRow(c.id, { note: e.target.value });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavrieť</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
