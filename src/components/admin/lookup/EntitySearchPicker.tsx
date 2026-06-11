import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchLookup } from "@/lib/crmLookup/fetchLookup";
import type { LookupKind, LookupResult } from "@/lib/crmLookup/types";
import { Link2 } from "lucide-react";

const KIND_LABELS: Record<LookupKind, string> = {
  customer: "Zákazník",
  client: "Klient",
  lead: "Lead",
  project: "Projekt",
  rental: "Prenájom",
  hosting: "Hosting",
  email: "E-mail",
};

export interface EntitySearchPickerProps {
  kind: LookupKind;
  value?: LookupResult | null;
  placeholder?: string;
  allowFreeText?: boolean;
  freeTextValue?: string;
  onFreeTextChange?: (text: string) => void;
  onSelect: (result: LookupResult | null) => void;
  disabled?: boolean;
  className?: string;
  /** When true, selected state shows linked styling (entity picker without free text). */
  linked?: boolean;
}

export function EntitySearchPicker({
  kind,
  value,
  placeholder,
  allowFreeText = false,
  freeTextValue = "",
  onFreeTextChange,
  onSelect,
  disabled,
  className,
  linked,
}: EntitySearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const rows = await fetchLookup(kind, q);
        setResults(rows);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, runSearch]);

  const clear = () => {
    onSelect(null);
    setQuery("");
  };

  if (value) {
    return (
      <div className={`flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-sm ${className ?? ""}`}>
        <Link2 className="w-3.5 h-3.5 shrink-0 text-primary opacity-70" aria-hidden />
        <div className="flex-1 min-w-0">
          <span className="font-medium truncate block">{value.label}</span>
          {value.sublabel && (
            <span className="text-[10px] text-muted-foreground truncate block">{value.sublabel}</span>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={clear}
          disabled={disabled}
          aria-label="Odstrániť výber"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      {allowFreeText && (
        <Input
          value={freeTextValue}
          onChange={(e) => onFreeTextChange?.(e.target.value)}
          placeholder={placeholder || "Meno / firma (voľný text)"}
          disabled={disabled}
          className={linked === false && freeTextValue ? "border-dashed" : undefined}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start text-xs font-normal"
            disabled={disabled}
          >
            <Search className="w-3.5 h-3.5 mr-2 shrink-0 opacity-60" />
            Vyhľadať {KIND_LABELS[kind].toLowerCase()}…
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b border-border">
            <Input
              placeholder={`Hľadať ${KIND_LABELS[kind].toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            {loading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Žiadne výsledky</p>
            ) : (
              results.map((row) => (
                <button
                  key={`${row.kind}-${row.id}`}
                  type="button"
                  className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onSelect(row);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="font-medium truncate">{row.label}</span>
                  {row.sublabel && (
                    <span className="text-[10px] text-muted-foreground truncate">{row.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
