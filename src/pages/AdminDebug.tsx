import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, XCircle, LogOut } from "lucide-react";

interface DebugInfo {
  sessionExists: boolean;
  userId: string | null;
  email: string | null;
  rolesRows: Array<{ role: string; created_at: string }>;
  isAdmin: boolean;
  hasRoleRpc: boolean | null;
  rolesError: string | null;
  rpcError: string | null;
  sessionError: string | null;
}

const initial: DebugInfo = {
  sessionExists: false,
  userId: null,
  email: null,
  rolesRows: [],
  isAdmin: false,
  hasRoleRpc: null,
  rolesError: null,
  rpcError: null,
  sessionError: null,
};

const AdminDebugPage = () => {
  const [info, setInfo] = useState<DebugInfo>(initial);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const next: DebugInfo = { ...initial };

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) next.sessionError = sessionError.message;

    const session = sessionData.session;
    next.sessionExists = !!session;
    next.userId = session?.user.id ?? null;
    next.email = session?.user.email ?? null;

    if (session?.user) {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role, created_at")
        .eq("user_id", session.user.id);

      if (rolesError) next.rolesError = rolesError.message;
      next.rolesRows = (roles ?? []) as Array<{ role: string; created_at: string }>;
      next.isAdmin = next.rolesRows.some(
        (r) => r.role === "admin" || r.role === "owner",
      );

      // has_role function is no longer exposed via RPC (moved to private schema for security).
      // Admin status is derived from the user_roles table read above.
      next.hasRoleRpc = next.isAdmin;
    }

    setInfo(next);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Admin Debug | Web na prenájom";
    void load();
  }, []);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono text-right break-all">{value}</span>
    </div>
  );

  const Bool = ({ value }: { value: boolean }) =>
    value ? (
      <span className="inline-flex items-center gap-1 text-green-600">
        <CheckCircle2 className="w-4 h-4" /> true
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="w-4 h-4" /> false
      </span>
    );

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Debug</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Odhlásiť
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Session</h2>
          <Row label="Prihlásený" value={<Bool value={info.sessionExists} />} />
          <Row label="User ID" value={info.userId ?? "—"} />
          <Row label="Email" value={info.email ?? "—"} />
          {info.sessionError && (
            <Row label="Session error" value={<span className="text-red-600">{info.sessionError}</span>} />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Roly v user_roles</h2>
          {info.rolesRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žiadne roly nenájdené pre tohto používateľa.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {info.rolesRows.map((r, i) => (
                <li key={i} className="font-mono">
                  • {r.role}{" "}
                  <span className="text-muted-foreground">
                    ({new Date(r.created_at).toLocaleString("sk-SK")})
                  </span>
                </li>
              ))}
            </ul>
          )}
          {info.rolesError && (
            <p className="text-sm text-red-600 mt-2">RLS/Query error: {info.rolesError}</p>
          )}
          <div className="mt-3">
            <Row label="isAdmin (klient)" value={<Bool value={info.isAdmin} />} />
            <Row
              label="has_role RPC (server)"
              value={
                info.hasRoleRpc === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Bool value={info.hasRoleRpc} />
                )
              }
            />
            {info.rpcError && (
              <Row label="RPC error" value={<span className="text-red-600">{info.rpcError}</span>} />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link to="/admin">
            <Button>Skúsiť /admin</Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline">Na prihlásenie</Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: Ak je <span className="font-mono">isAdmin</span> false ale <span className="font-mono">has_role RPC</span> true,
          ide o RLS problém. Ak nie je session, treba sa najprv prihlásiť.
        </p>
      </div>
    </main>
  );
};

/** Dev-only diagnostics — production builds redirect (CLAUDE.md / RELEASE.md). */
export default function AdminDebug() {
  if (import.meta.env.PROD) {
    return <Navigate to="/admin/today" replace />;
  }
  return <AdminDebugPage />;
}
