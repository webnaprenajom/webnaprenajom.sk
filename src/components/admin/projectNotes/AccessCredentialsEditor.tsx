import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import {
  type AccessCredential,
  createEmptyCredential,
} from "@/lib/projectCredentials";

interface Props {
  credentials: AccessCredential[];
  onChange: (next: AccessCredential[]) => void;
}

export function AccessCredentialsEditor({ credentials, onChange }: Props) {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const update = (index: number, patch: Partial<AccessCredential>) => {
    const next = credentials.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(credentials.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...credentials, createEmptyCredential()]);
  };

  return (
    <div className="space-y-3">
      {credentials.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Zatiaľ žiadne prístupy. Pridajte riadok pre admin, FTP, hosting alebo iný login.
        </p>
      )}
      {credentials.map((cred, index) => (
        <div
          key={cred.id}
          className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Prístup #{index + 1}</Label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => remove(index)}
              aria-label="Odstrániť prístup"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Účel / popis</Label>
            <Input
              placeholder="napr. WordPress admin, FTP, Shoptet"
              value={cred.label}
              onChange={(e) => update(index, { label: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">URL / systém</Label>
            <Input
              placeholder="https://… alebo názov systému"
              value={cred.url || ""}
              onChange={(e) => update(index, { url: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Login / e-mail</Label>
              <Input
                value={cred.login || ""}
                onChange={(e) => update(index, { login: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Heslo</Label>
              <div className="flex gap-1">
                <Input
                  type={visiblePasswords[cred.id] ? "text" : "password"}
                  value={cred.password || ""}
                  onChange={(e) => update(index, { password: e.target.value })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    setVisiblePasswords((s) => ({ ...s, [cred.id]: !s[cred.id] }))
                  }
                >
                  {visiblePasswords[cred.id] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Poznámka (voliteľné)</Label>
            <NoteTextarea
              value={cred.note || ""}
              onChange={(v) => update(index, { note: v })}
              rows={2}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full sm:w-auto">
        <Plus className="w-4 h-4 mr-1" /> Pridať prístup
      </Button>
    </div>
  );
}
