import { useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface LeadOption {
  id: string;
  name: string;
  email: string | null;
}

export interface LeadClientPickerProps {
  leads: LeadOption[];
  clientName: string;
  leadId: string;
  onChange: (value: { client_name: string; lead_id: string | null }) => void;
}

export function LeadClientPicker({ leads, clientName, leadId, onChange }: LeadClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLead = leadId ? leads.find((l) => l.id === leadId) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads.slice(0, 25);
    return leads
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [leads, query]);

  const selectLead = (lead: LeadOption) => {
    onChange({ client_name: lead.name, lead_id: lead.id });
    setQuery("");
    setOpen(false);
  };

  const clearLink = () => {
    onChange({ client_name: selectedLead?.name || clientName, lead_id: null });
  };

  if (selectedLead) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-sm">
          <span className="flex-1 truncate font-medium">{selectedLead.name}</span>
          {selectedLead.email && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              {selectedLead.email}
            </span>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={clearLink}
            aria-label="Odpojiť lead"
            title="Odpojiť lead"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Prepojené s leadom — uloží sa lead_id + meno</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        value={clientName}
        onChange={(e) => onChange({ client_name: e.target.value, lead_id: null })}
        placeholder="Meno klienta / firma"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            Prepojiť s leadom
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Meno, e-mail…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Žiadny lead</p>
            ) : (
              filtered.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => selectLead(lead)}
                >
                  <span className="font-medium truncate">{lead.name}</span>
                  {lead.email && (
                    <span className="text-[10px] text-muted-foreground truncate">{lead.email}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-[10px] text-muted-foreground">
        Voľný text sa uloží do client_name (legacy). Prepoj lead pre lead_id.
      </p>
    </div>
  );
}
