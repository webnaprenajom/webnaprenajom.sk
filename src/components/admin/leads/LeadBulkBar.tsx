import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, MailX, Move, Trash2, UserCog, Flame } from "lucide-react";

export interface StatusOption {
  value: string;
  label: string;
}

export interface LeadBulkBarProps {
  count: number;
  statusOptions: StatusOption[];
  assigneeOptions: readonly string[];
  unassignedSentinel: string;
  onSetStatus: (status: string) => void;
  onSetAssignee: (assignee: string | null) => void;
  onSetTemperature: (temp: "hot" | "neutral" | "cold" | null) => void;
  onMoveStale: () => void;
  onMoveArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const LeadBulkBar = ({
  count,
  statusOptions,
  assigneeOptions,
  unassignedSentinel,
  onSetStatus,
  onSetAssignee,
  onSetTemperature,
  onMoveStale,
  onMoveArchive,
  onDelete,
  onClear,
}: LeadBulkBarProps) => {
  if (count <= 0) return null;
  return (
    <section className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
      <span className="text-sm font-semibold">{count} vybraných</span>

      <Select onValueChange={(v) => onSetStatus(v)}>
        <SelectTrigger className="h-8 w-[200px] text-xs">
          <Move className="w-3.5 h-3.5 mr-1" />
          <SelectValue placeholder="Presunúť do statusu…" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) =>
          onSetAssignee(v === unassignedSentinel ? null : v)
        }
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <UserCog className="w-3.5 h-3.5 mr-1" />
          <SelectValue placeholder="Priradiť…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={unassignedSentinel}>— Nepriradené —</SelectItem>
          {assigneeOptions.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(v) =>
          onSetTemperature(
            v === "__clear__"
              ? null
              : (v as "hot" | "neutral" | "cold")
          )
        }
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <Flame className="w-3.5 h-3.5 mr-1" />
          <SelectValue placeholder="Teplota…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hot">Hot</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
          <SelectItem value="cold">Cold</SelectItem>
          <SelectItem value="__clear__">— Vyčistiť —</SelectItem>
        </SelectContent>
      </Select>

      <Button size="sm" variant="outline" onClick={onMoveStale}>
        <MailX className="w-4 h-4 mr-2" /> Bez reakcie
      </Button>
      <Button size="sm" variant="outline" onClick={onMoveArchive}>
        <Archive className="w-4 h-4 mr-2" /> Archív
      </Button>
      <Button size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 className="w-4 h-4 mr-2" /> Vymazať
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Zrušiť výber
      </Button>
    </section>
  );
};

export default LeadBulkBar;
