import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Mail, MoreHorizontal, Plus, Search, Upload } from "lucide-react";
import {
  ASSIGNEES,
  STATUS_CONFIG,
  TYPE_OPTIONS,
  UNASSIGNED,
} from "./constants";

export interface LeadsToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (v: string) => void;
  onAddLead: () => void;
  onBulkOffer: () => void;
  onImportClick: () => void;
  onExport: () => void;
}

const LeadsToolbar = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  onAddLead,
  onBulkOffer,
  onImportClick,
  onExport,
}: LeadsToolbarProps) => {
  return (
    <section className="flex flex-col sm:flex-row flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Hľadať podľa mena, e-mailu, telefónu, zdroja, riešiteľa..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všetky statusy</SelectItem>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Typ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všetky typy</SelectItem>
          {TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={assigneeFilter} onValueChange={onAssigneeFilterChange}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Kto rieši" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všetci riešitelia</SelectItem>
          <SelectItem value={UNASSIGNED}>— Nepriradené —</SelectItem>
          {ASSIGNEES.map((a) => (
            <SelectItem key={a} value={a}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={onAddLead} variant="gradient">
        <Plus className="w-4 h-4 mr-2" /> Nový lead
      </Button>
      <Button onClick={onBulkOffer} variant="outline" title="Vyžaduje výber leadov v tabuľke">
        <Mail className="w-4 h-4 mr-2" /> Poslať ponuku
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Ďalšie akcie">
            <MoreHorizontal className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Viac</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onImportClick}>
            <Upload className="w-4 h-4 mr-2" /> Import CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
};

export default LeadsToolbar;
