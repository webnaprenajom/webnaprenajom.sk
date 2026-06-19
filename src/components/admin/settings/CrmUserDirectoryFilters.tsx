import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserDirectoryFilters } from "@/lib/admin/crmUserDirectory";

type Props = {
  filters: UserDirectoryFilters;
  onChange: (next: UserDirectoryFilters) => void;
  showMappingFilter?: boolean;
};

export function CrmUserDirectoryFilters({ filters, onChange, showMappingFilter = true }: Props) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        Vyhľadávajte podľa mena alebo e-mailu. Pre zápis sa vždy používa interné ID účtu — UUID
        nie je potrebné kopírovať.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Hľadať</Label>
          <Input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Meno alebo e-mail…"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rola</Label>
          <Select
            value={filters.role}
            onValueChange={(v) => onChange({ ...filters, role: v as UserDirectoryFilters["role"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky role</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="administrator">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {showMappingFilter && (
          <div className="space-y-1.5">
            <Label className="text-xs">Team profile</Label>
            <Select
              value={filters.mapping}
              onValueChange={(v) =>
                onChange({ ...filters, mapping: v as UserDirectoryFilters["mapping"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky stavy</SelectItem>
                <SelectItem value="missing">Chýba mapovanie</SelectItem>
                <SelectItem value="ok">Mapovanie OK</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
