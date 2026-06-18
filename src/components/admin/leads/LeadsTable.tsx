import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Mail,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Lead,
  LeadStatus,
  LeadTemperature,
  SortDir,
  SortKey,
  STATUS_CONFIG,
  TEMP_CONFIG,
  typeLabel,
} from "./constants";

export interface LeadsTableProps {
  loading: boolean;
  leads: Lead[];
  selectedIds: Set<string>;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onOpenLead: (lead: Lead) => void;
  onSetStatus: (lead: Lead, status: LeadStatus) => void;
  onSetTemperature: (lead: Lead, temp: "hot" | "neutral" | "cold") => void;
  onRequestDelete: (id: string) => void;
}

const LeadsTable = ({
  loading,
  leads,
  selectedIds,
  sortKey,
  sortDir,
  onToggleSort,
  onToggleAll,
  onToggleOne,
  onOpenLead,
  onSetStatus,
  onSetTemperature,
  onRequestDelete,
}: LeadsTableProps) => {
  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline opacity-40 ml-1" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 inline ml-1" />
      : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Žiadne leady</div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:p-2">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px]" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={leads.length > 0 && leads.every((l) => selectedIds.has(l.id))}
                    onCheckedChange={(v) => onToggleAll(!!v)}
                    aria-label="Vybrať všetky"
                  />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => onToggleSort("created_at")}>
                  Dátum<SortIcon k="created_at" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => onToggleSort("name")}>
                  Meno<SortIcon k="name" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => onToggleSort("email")}>
                  Kontakt<SortIcon k="email" />
                </TableHead>
                <TableHead className="cursor-pointer select-none min-w-[170px]" onClick={() => onToggleSort("status")}>
                  Status<SortIcon k="status" />
                </TableHead>
                <TableHead className="whitespace-nowrap text-[11px]">Stav od</TableHead>
                <TableHead>Pozn.</TableHead>
                <TableHead className="text-center cursor-pointer select-none whitespace-nowrap" onClick={() => onToggleSort("temperature")}>
                  Tep.<SortIcon k="temperature" />
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">Suma</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => onToggleSort("source")}>
                  Zdroj<SortIcon k="source" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => onToggleSort("type")}>
                  Typ<SortIcon k="type" />
                </TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const cfg = STATUS_CONFIG[lead.status];
                const checked = selectedIds.has(lead.id);
                return (
                  <TableRow
                    key={lead.id}
                    className={`cursor-pointer ${cfg?.borderClass || ""} ${cfg?.rowClass || "hover:bg-muted/50"}`}
                    onClick={() => onOpenLead(lead)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => onToggleOne(lead.id, !!v)}
                        aria-label="Vybrať lead"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("sk-SK", {
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-xs max-w-[140px] truncate">{lead.name}</TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="flex items-center gap-1 text-muted-foreground text-[11px] truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                          <Phone className="w-3 h-3 shrink-0" />
                          {lead.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.status}
                        onValueChange={(v) => onSetStatus(lead, v as LeadStatus)}
                      >
                        <SelectTrigger className={`h-7 text-[10px] px-2 min-w-[160px] ${STATUS_CONFIG[lead.status]?.className}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {lead.status_changed_at ? (
                        <span title={new Date(lead.status_changed_at).toLocaleString("sk-SK")}>
                          {new Date(lead.status_changed_at).toLocaleDateString("sk-SK", { day: "numeric", month: "short" })}
                          <span className="opacity-60"> · {new Date(lead.status_changed_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}</span>
                        </span>
                      ) : (
                        <span className="italic opacity-60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-[160px]">
                      <div className="line-clamp-2 whitespace-pre-wrap">
                        {lead.notes || <span className="italic opacity-60">—</span>}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0">
                        {(["hot", "neutral", "cold"] as const).map((t) => {
                          const tcfg = TEMP_CONFIG[t];
                          const Icon = tcfg.icon;
                          const active = lead.temperature === t;
                          return (
                            <Button
                              key={t}
                              size="icon"
                              variant="ghost"
                              title={tcfg.label}
                              onClick={() => onSetTemperature(lead, t)}
                              className={`h-6 w-6 ${tcfg.className} ${active ? "bg-current/10 ring-1 ring-current" : "opacity-40 hover:opacity-100"}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </Button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {lead.amount != null ? (
                        <span className="font-bold text-green-600 dark:text-green-500 text-xs">
                          {Number(lead.amount).toLocaleString("sk-SK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}&nbsp;€
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground opacity-60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] max-w-[100px] truncate">
                      {lead.source || <span className="italic text-muted-foreground opacity-60">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {typeLabel(lead.type)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {lead.email && (
                          <Link
                            to={`/admin/customer/${encodeURIComponent(lead.email.trim().toLowerCase())}`}
                            title="Otvoriť customer view"
                          >
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                            >
                              <User className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onRequestDelete(lead.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
};

export default LeadsTable;
