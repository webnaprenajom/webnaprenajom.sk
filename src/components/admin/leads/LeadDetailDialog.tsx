import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { CalendarIcon, Euro, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ASSIGNEES,
  Lead,
  LeadStatus,
  LeadTemperature,
  STATUS_CONFIG,
  TEMP_CONFIG,
  TYPE_OPTIONS,
  UNASSIGNED,
} from "./constants";

export interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Lead | null;
  saving: boolean;
  onSave: () => void;
  // Form state + setters
  editName: string;
  setEditName: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editPhone: string;
  setEditPhone: (v: string) => void;
  editType: string;
  setEditType: (v: string) => void;
  editStatus: LeadStatus;
  setEditStatus: (v: LeadStatus) => void;
  editSource: string;
  setEditSource: (v: string) => void;
  editAssigned: string;
  setEditAssigned: (v: string) => void;
  editTemperature: LeadTemperature;
  setEditTemperature: (v: LeadTemperature) => void;
  editAmount: string;
  setEditAmount: (v: string) => void;
  editConsultDate: Date | undefined;
  setEditConsultDate: (v: Date | undefined) => void;
  editConsultTime: string;
  setEditConsultTime: (v: string) => void;
  editFollowUpDate: Date | undefined;
  setEditFollowUpDate: (v: Date | undefined) => void;
  editCreatedAt: Date | undefined;
  setEditCreatedAt: (v: Date | undefined) => void;
  editNotes: string;
  setEditNotes: (v: string) => void;
}

const LeadDetailDialog = ({
  open,
  onOpenChange,
  selected,
  saving,
  onSave,
  editName, setEditName,
  editEmail, setEditEmail,
  editPhone, setEditPhone,
  editType, setEditType,
  editStatus, setEditStatus,
  editSource, setEditSource,
  editAssigned, setEditAssigned,
  editTemperature, setEditTemperature,
  editAmount, setEditAmount,
  editConsultDate, setEditConsultDate,
  editConsultTime, setEditConsultTime,
  editFollowUpDate, setEditFollowUpDate,
  editCreatedAt, setEditCreatedAt,
  editNotes, setEditNotes,
}: LeadDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail leadu</DialogTitle>
        </DialogHeader>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-muted-foreground text-xs">Meno</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Meno klienta"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Dátum príchodu</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editCreatedAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editCreatedAt ? format(editCreatedAt, "d. M. yyyy") : <span>Vyber dátum</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editCreatedAt}
                      onSelect={setEditCreatedAt}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {editCreatedAt && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditCreatedAt(undefined)}>
                          Zrušiť dátum
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-muted-foreground text-xs">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@example.sk"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="text-muted-foreground text-xs">Telefón</Label>
                <Input
                  id="edit-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+421..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Termín konzultácie</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editConsultDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editConsultDate ? format(editConsultDate, "d. M. yyyy") : <span>Vyber dátum</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editConsultDate}
                      onSelect={setEditConsultDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {editConsultDate && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditConsultDate(undefined)}>
                          Zrušiť dátum
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time" className="text-muted-foreground text-xs">Čas</Label>
                <Input
                  id="edit-time"
                  value={editConsultTime}
                  onChange={(e) => setEditConsultTime(e.target.value)}
                  placeholder="napr. 14:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount" className="text-muted-foreground text-xs">Suma (€)</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                  <Input
                    id="edit-amount"
                    inputMode="decimal"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="0"
                    className="pl-9 font-bold text-green-600"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Ozvať sa klientovi dňa
              </Label>
              <p className="text-xs text-muted-foreground">
                Lead sa v tento deň automaticky objaví v sekcii „Dnes musíš urobiť".
              </p>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !editFollowUpDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editFollowUpDate ? format(editFollowUpDate, "d. M. yyyy") : <span>Vyber dátum follow-upu</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editFollowUpDate}
                      onSelect={setEditFollowUpDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {[1, 3, 7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const dt = new Date();
                      dt.setDate(dt.getDate() + d);
                      setEditFollowUpDate(dt);
                    }}
                  >
                    +{d}d
                  </Button>
                ))}
                {editFollowUpDate && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditFollowUpDate(undefined)}>
                    Zrušiť
                  </Button>
                )}
              </div>
            </div>

            {selected.message && (
              <div>
                <Label className="text-muted-foreground text-xs">Správa od klienta</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="type">Typ</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as LeadStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected.status_changed_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Naposledy zmenený: {new Date(selected.status_changed_at).toLocaleString("sk-SK")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Zdroj</Label>
                <Input
                  id="source"
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  placeholder="napr. Google, Facebook..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned">Kto rieši</Label>
              <Select
                value={editAssigned || UNASSIGNED}
                onValueChange={(v) => setEditAssigned(v === UNASSIGNED ? "" : v)}
              >
                <SelectTrigger id="assigned">
                  <SelectValue placeholder="Nepriradené" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>— Nepriradené —</SelectItem>
                  {ASSIGNEES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Teplota leadu</Label>
              <div className="flex gap-2">
                {(["hot", "neutral", "cold"] as const).map((t) => {
                  const tcfg = TEMP_CONFIG[t];
                  const Icon = tcfg.icon;
                  const active = editTemperature === t;
                  return (
                    <Button
                      key={t}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditTemperature(active ? null : t)}
                      className={!active ? tcfg.className : ""}
                    >
                      <Icon className="w-4 h-4 mr-1.5" />
                      {tcfg.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Interné poznámky</Label>
              <NoteTextarea
                id="notes"
                value={editNotes}
                onChange={setEditNotes}
                placeholder="Doplň poznámky o klientovi, dohodách, follow-up..."
                className="min-h-[120px]"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 flex-wrap">
              {editEmail && (
                <Link
                  to={`/admin/customer/${encodeURIComponent(editEmail.trim().toLowerCase())}`}
                  className="mr-auto"
                >
                  <Button variant="outline" type="button">
                    <User className="w-4 h-4 mr-2" />
                    Customer view
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Zrušiť
              </Button>
              <Button onClick={onSave} variant="gradient" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Uložiť
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
