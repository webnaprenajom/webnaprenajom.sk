import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function HubSectionCard({
  title,
  loading,
  error,
  empty,
  emptyMessage = "Žiadne záznamy.",
  onRetry,
  children,
  className = "",
}: Props) {
  return (
    <section className={`rounded-xl border border-border bg-card ${className}`}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {onRetry && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRetry}>
                <RefreshCw className="w-3 h-3 mr-1" /> Skúsiť znova
              </Button>
            )}
          </div>
        ) : empty ? (
          <div className="py-4 flex flex-col items-center gap-2 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
