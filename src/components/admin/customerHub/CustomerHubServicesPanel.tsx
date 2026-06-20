import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NOTE_STATUS_LABEL, SIGNATURE_STATUS_LABEL } from "@/lib/customerWorkbench/constants";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";
import { FolderKanban, Globe, Server } from "lucide-react";

interface Props {
  data: CustomerWorkbenchData;
}

type ServiceRow = {
  id: string;
  kind: "rental" | "hosting" | "project" | "signature";
  title: string;
  subtitle?: string;
  active: boolean;
  monthlyPrice?: number | null;
  href: string;
  statusLabel?: string;
  meta?: React.ReactNode;
};

function buildServiceRows(data: CustomerWorkbenchData): ServiceRow[] {
  const rows: ServiceRow[] = [];

  data.rentals.forEach((r) => {
    rows.push({
      id: `rental-${r.id}`,
      kind: "rental",
      title: r.name,
      subtitle: r.url || undefined,
      active: true,
      monthlyPrice: r.monthly_price,
      href: "/admin/rentals",
      statusLabel: "Aktívny",
    });
  });

  data.hosting.forEach((h) => {
    rows.push({
      id: `hosting-${h.id}`,
      kind: "hosting",
      title: h.client_name || h.provider || "Hosting",
      subtitle: h.provider || undefined,
      active: h.active,
      monthlyPrice: h.monthly_price,
      href: `/admin/hosting/${h.id}`,
      statusLabel: h.active ? "Aktívny" : "Neaktívny",
    });
  });

  data.notes.forEach((n) => {
    const active = !["done", "archived"].includes(n.status);
    rows.push({
      id: `project-${n.id}`,
      kind: "project",
      title: n.title,
      subtitle: n.url || undefined,
      active,
      href: `/admin/projects/${n.id}`,
      statusLabel: NOTE_STATUS_LABEL[n.status] || n.status,
    });
  });

  data.signatures.forEach((s) => {
    rows.push({
      id: `sig-${s.id}`,
      kind: "signature",
      title: s.package_name || s.plan,
      subtitle: s.client_name,
      active: s.status !== "canceled",
      monthlyPrice: null,
      href: "/admin/signatures",
      statusLabel: SIGNATURE_STATUS_LABEL[s.status] || s.status,
    });
  });

  return rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.title.localeCompare(b.title, "sk");
  });
}

const KIND_ICON = {
  rental: Globe,
  hosting: Server,
  project: FolderKanban,
  signature: Globe,
};

export function CustomerHubServicesPanel({ data }: Props) {
  const rows = buildServiceRows(data);
  const activeCount = rows.filter((r) => r.active).length;

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Služby{" "}
          <span className="text-muted-foreground font-normal">
            ({activeCount} aktívnych / {rows.length})
          </span>
        </h3>
      </div>
      <ul className="px-4 divide-y divide-border max-h-[280px] overflow-y-auto">
        {rows.map((row) => {
          const Icon = KIND_ICON[row.kind];
          return (
            <li key={row.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">{row.title}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      row.active
                        ? "border-green-500/40 text-green-700 dark:text-green-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {row.statusLabel}
                  </Badge>
                </div>
                {row.subtitle && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{row.subtitle}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {row.monthlyPrice != null && row.monthlyPrice > 0 && (
                    <span className="text-xs font-semibold tabular-nums">
                      {Number(row.monthlyPrice).toLocaleString("sk-SK")} €/mes
                    </span>
                  )}
                  {row.meta}
                </div>
              </div>
              <Link to={row.href} className="shrink-0">
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Detail
                </Button>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
