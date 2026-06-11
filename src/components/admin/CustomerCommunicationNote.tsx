import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { insertCommunicationEvent } from "@/lib/communication/events";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageSquarePlus } from "lucide-react";

interface Props {
  customerId: string | null;
  customerEmail: string | null;
  onSaved: () => void;
}

export function CustomerCommunicationNote({ customerId, customerEmail, onSaved }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!note.trim()) {
      toast({ title: "Zadaj text poznámky", variant: "destructive" });
      return;
    }
    if (!customerId && !customerEmail) {
      toast({
        title: "Chýba zákazník",
        description: "Poznámku nie je možné uložiť bez customer_id alebo e-mailu.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const result = await insertCommunicationEvent({
      kind: "note",
      title: "Interná poznámka",
      body_preview: note.trim(),
      customer_id: customerId,
      customer_email: customerEmail,
      metadata: { origin: "admin_customer_note" },
    });
    setSaving(false);

    if (!result.ok) {
      toast({
        title: "Poznámku sa nepodarilo uložiť",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({ title: result.deduped ? "Poznámka už existuje" : "Poznámka uložená" });
    setNote("");
    onSaved();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Interná poznámka</h2>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Uloží sa do histórie zákazníka ako interná poznámka (viditeľná v časovej osi).
      </p>
      <NoteTextarea value={note} onChange={setNote} rows={3} placeholder="Poznámka pre tím…" />
      <Button size="sm" onClick={() => void save()} disabled={saving || !note.trim()}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Uložiť poznámku
      </Button>
    </section>
  );
}
