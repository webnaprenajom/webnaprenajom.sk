import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { changeOwnPassword } from "@/lib/auth/changeOwnPassword";
import { Loader2 } from "lucide-react";

export function OwnerPasswordChangePanel({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await changeOwnPassword(supabase, email, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Zmena hesla zlyhala", description: result.message, variant: "destructive" });
      return;
    }
    resetForm();
    toast({ title: "Heslo zmenené", description: "Pri ďalšom prihlásení použite nové heslo." });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2.5 pt-1 border-t border-border/60">
      <p className="text-xs font-medium">Zmeniť heslo</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="owner-current-password" className="text-[10px] text-muted-foreground">
            Aktuálne heslo
          </Label>
          <Input
            id="owner-current-password"
            type="password"
            autoComplete="current-password"
            className="h-8 text-xs"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="owner-new-password" className="text-[10px] text-muted-foreground">
            Nové heslo
          </Label>
          <Input
            id="owner-new-password"
            type="password"
            autoComplete="new-password"
            className="h-8 text-xs"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="owner-confirm-password" className="text-[10px] text-muted-foreground">
            Potvrdenie
          </Label>
          <Input
            id="owner-confirm-password"
            type="password"
            autoComplete="new-password"
            className="h-8 text-xs"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
        {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
        Uložiť nové heslo
      </Button>
    </form>
  );
}
