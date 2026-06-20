import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  CredentialFormDialog,
  type EntityOptions,
} from "@/components/admin/customerCredentials/CredentialFormDialog";
import type { CustomerWorkbenchContext } from "@/lib/customerWorkbench/types";
import {
  MASKED_PASSWORD,
  type CredentialFormState,
  type CustomerCredential,
  type LinkedEntityType,
  credentialDisplayLabel,
  emptyCredentialFormState,
  linkedEntityTypeLabel,
} from "@/lib/customerCredentials";
import {
  deleteCustomerCredential,
  loadCredentialEntityOptions,
  loadCredentialFormForEdit,
  saveCustomerCredentialBatch,
} from "@/lib/customerCredentialsSave";
import { Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

function entityHref(type: LinkedEntityType | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "project":
      return `/admin/projects/${id}`;
    case "hosting":
      return `/admin/hosting/${id}`;
    case "marketing":
      return `/admin/marketing/${id}`;
    case "rental":
      return `/admin/rentals`;
    default:
      return null;
  }
}

type Props = {
  credentials: CustomerCredential[];
  ctx: CustomerWorkbenchContext;
  onReload: () => void;
};

export function CustomerCredentialsPanel({ credentials, ctx, onReload }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CredentialFormState | null>(null);
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<EntityOptions>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);

  const resetForm = () => {
    setForm(null);
    setRemovedDbIds([]);
  };

  const openCreate = async () => {
    setCustomerFieldError(null);
    setRemovedDbIds([]);
    setForm(
      emptyCredentialFormState({
        customer_id: ctx.resolvedCustomerId,
        customer_email: ctx.emailKey || null,
        client_name: ctx.clientName,
        lead_id: ctx.primaryLeadId,
      }),
    );
    setEntityOptions(
      await loadCredentialEntityOptions(
        ctx.resolvedCustomerId,
        ctx.emailKey || null,
        ctx.clientName,
      ),
    );
    setOpen(true);
  };

  const openEdit = async (item: CustomerCredential) => {
    setCustomerFieldError(null);
    setRemovedDbIds([]);
    const loaded = await loadCredentialFormForEdit(item);
    setForm(loaded);
    setEntityOptions(
      await loadCredentialEntityOptions(item.customer_id, item.customer_email, item.client_name),
    );
    setOpen(true);
  };

  const onCustomerChange = async () => {
    // locked in workbench context
  };

  const save = async (): Promise<boolean> => {
    if (!form) return false;
    const result = await saveCustomerCredentialBatch(form, removedDbIds);
    if (!result.ok) {
      if (result.customerFieldError) setCustomerFieldError(result.customerFieldError);
      toast({ title: "Uloženie zlyhalo", description: result.message, variant: "destructive" });
      return false;
    }
    toast({
      title: result.savedCount > 1 ? `${result.savedCount} prístupov uložených` : "Prístup uložený",
    });
    setOpen(false);
    resetForm();
    onReload();
    return true;
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať tento prístup?")) return;
    const error = await deleteCustomerCredential(id);
    if (error) toast({ title: "Chyba", description: error, variant: "destructive" });
    else {
      toast({ title: "Zmazané" });
      onReload();
    }
  };

  const copy = (val: string | null, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: `${label} skopírované` });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Prístupy sú viazané na klienta. Celý prehľad v{" "}
          <Link to="/admin/passwords" className="text-primary hover:underline">
            Heslá
          </Link>
          .
        </p>
        <Button size="sm" onClick={() => void openCreate()}>
          <Plus className="w-4 h-4 mr-1" /> Nový prístup
        </Button>
      </div>

      {credentials.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-6 text-center border border-dashed rounded-xl">
          Žiadne uložené prístupy pre tohto klienta.
        </p>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategória</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Heslo</TableHead>
                <TableHead>Prepojenie</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((item) => {
                const shown = reveal[item.id];
                const linkHref = entityHref(item.linked_entity_type, item.linked_entity_id);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {credentialDisplayLabel(item)}
                      </Badge>
                      {item.url && (
                        <span className="block text-[10px] text-muted-foreground truncate max-w-[140px] mt-0.5">
                          {item.url}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-[120px]">
                      {item.login || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.password ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono truncate max-w-[100px]">
                            {shown ? item.password : MASKED_PASSWORD}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setReveal((r) => ({ ...r, [item.id]: !r[item.id] }))}
                          >
                            {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => copy(item.password, "Heslo")}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.linked_entity_type && item.linked_entity_id ? (
                        linkHref ? (
                          <Link to={linkHref} className="text-primary hover:underline">
                            {linkedEntityTypeLabel(item.linked_entity_type)}
                          </Link>
                        ) : (
                          linkedEntityTypeLabel(item.linked_entity_type)
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => void openEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => void remove(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CredentialFormDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
        form={form}
        setForm={setForm}
        removedDbIds={removedDbIds}
        onRemoveItem={(dbId) => {
          if (dbId) setRemovedDbIds((ids) => [...ids, dbId]);
        }}
        entityOptions={entityOptions}
        onCustomerChange={onCustomerChange}
        onSave={save}
        customerFieldError={customerFieldError}
        onClearCustomerFieldError={() => setCustomerFieldError(null)}
        lockCustomer
      />
    </>
  );
}
