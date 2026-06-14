import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TimelineEvent } from "@/components/admin/CustomerTimeline";
import { TIMELINE_CATEGORY_LABELS } from "@/lib/crmLookup/timeline";
import { AlertCircle, ChevronDown, ChevronRight, Clock, Loader2 } from "lucide-react";

interface Props {
  events: TimelineEvent[];
  loading?: boolean;
  error?: string | null;
  limit?: number;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Neznáme";
  return d.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });
}

function TimelineRow({ item }: { item: TimelineEvent }) {
  return (
    <li className="py-2.5 flex items-start justify-between gap-2 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          {item.category && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
              {TIMELINE_CATEGORY_LABELS[item.category]}
            </Badge>
          )}
          <span className="font-medium truncate flex items-center gap-1 min-w-0 text-xs">
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            {item.label}
          </span>
        </div>
        {item.detail && (
          <div className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2">{item.detail}</div>
        )}
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {new Date(item.at).toLocaleString("sk-SK")}
        </div>
      </div>
      {item.href && (
        <Link to={item.href} className="shrink-0">
          <Button size="sm" variant="ghost" className="h-7 text-xs">
            Detail
          </Button>
        </Link>
      )}
    </li>
  );
}

export function CustomerFlowTimeline({ events, loading, error, limit = 12 }: Props) {
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit),
    [events, limit],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    sorted.forEach((e) => {
      const key = monthKey(e.at);
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [sorted]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleMonth = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tok klienta</h3>
        {!loading && !error && (
          <span className="text-[10px] text-muted-foreground">{sorted.length} udalostí</span>
        )}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs">Načítavam…</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Zatiaľ žiadna aktivita.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([month, monthEvents]) => {
              const isCollapsed = collapsed[month] ?? false;
              return (
                <div key={month}>
                  <button
                    type="button"
                    onClick={() => toggleMonth(month)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-1"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {month}
                    <span className="font-normal">({monthEvents.length})</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="pl-1">
                      {monthEvents.map((item) => (
                        <TimelineRow key={item.id} item={item} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
