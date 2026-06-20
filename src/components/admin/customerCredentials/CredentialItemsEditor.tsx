import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import {
  CREDENTIAL_CATEGORIES,
  type CredentialCategory,
  type CredentialFormItem,
  createEmptyFormItem,
} from "@/lib/customerCredentials";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

type Props = {
  items: CredentialFormItem[];
  onChange: (next: CredentialFormItem[]) => void;
  onRemoveItem: (item: CredentialFormItem, index: number) => void;
};

export function CredentialItemsEditor({ items, onChange, onRemoveItem }: Props) {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const update = (index: number, patch: Partial<CredentialFormItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const add = () => {
    const category = items[items.length - 1]?.category ?? "web_admin";
    onChange([...items, createEmptyFormItem(category)]);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.key}
          className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Prihlasovacie údaje #{index + 1}
            </Label>
            {items.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive"
                onClick={() => onRemoveItem(item, index)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Odstrániť
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Kategória *</Label>
              <Select
                value={item.category}
                onValueChange={(v) => update(index, { category: v as CredentialCategory })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Označenie *</Label>
              <Input
                placeholder="napr. WordPress admin, FTP, e-mail…"
                value={item.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">URL / systém</Label>
            <Input
              placeholder="https://…"
              value={item.url}
              onChange={(e) => update(index, { url: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Login / e-mail</Label>
              <Input
                value={item.login}
                onChange={(e) => update(index, { login: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Heslo</Label>
              <div className="flex gap-1">
                <Input
                  type={visiblePasswords[item.key] ? "text" : "password"}
                  value={item.password}
                  onChange={(e) => update(index, { password: e.target.value })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    setVisiblePasswords((s) => ({ ...s, [item.key]: !s[item.key] }))
                  }
                >
                  {visiblePasswords[item.key] ? (
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
              rows={2}
              value={item.note}
              onChange={(v) => update(index, { note: v })}
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full sm:w-auto">
        <Plus className="w-4 h-4 mr-1" /> Pridať ďalšie prihlasovacie údaje
      </Button>
    </div>
  );
}
