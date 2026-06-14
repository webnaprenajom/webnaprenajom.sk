import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDestructiveActionModal } from "@/components/admin/destructive/ConfirmDestructiveActionModal";
import { logAdminAuditEvent } from "@/lib/audit/auditLog";
import { executeDestructiveDelete, precheckDestructiveDelete } from "@/lib/destructive/client";
import {
  destructiveEntityTypeLabel,
  type DestructiveDeleteRequest,
  type DestructiveImpactSummary,
} from "@/lib/destructive/types";
import { toast } from "@/hooks/use-toast";
import { useAdminAccess } from "@/hooks/useAdminAccess";

type Options = {
  onSuccess?: () => void;
};

export function useDestructiveAction(options: Options = {}) {
  const navigate = useNavigate();
  const { userId } = useAdminAccess();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<DestructiveDeleteRequest | null>(null);
  const [impact, setImpact] = useState<DestructiveImpactSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestDelete = useCallback(async (req: DestructiveDeleteRequest) => {
    setRequest(req);
    setOpen(true);
    setLoading(true);
    setError(null);
    setImpact(null);

    const { impact: summary, error: precheckError } = await precheckDestructiveDelete(
      req.entityType,
      req.entityId,
    );

    setLoading(false);
    if (precheckError) {
      setError(precheckError);
      return;
    }
    setImpact(summary);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!request || !impact?.can_delete) return;
    setExecuting(true);
    setError(null);

    const { result, error: execError } = await executeDestructiveDelete(
      request.entityType,
      request.entityId,
    );

    setExecuting(false);

    if (execError || !result) {
      setError(execError ?? "Zmazanie zlyhalo.");
      toast({
        title: "Zmazanie zlyhalo",
        description: execError ?? undefined,
        variant: "destructive",
      });
      return;
    }

    if (userId) {
      await logAdminAuditEvent({
        actorUserId: userId,
        actionType: "entity_deleted",
        targetType: request.entityType,
        targetId: request.entityId,
        summary: `Zmazaný ${destructiveEntityTypeLabel(request.entityType)}: ${impact.entity_label}`,
        before: impact as unknown as Record<string, unknown>,
        after: result as unknown as Record<string, unknown>,
      });
    }

    setOpen(false);
    toast({
      title: "Zmazané",
      description: `${impact.entity_label} bol odstránený.`,
    });

    options.onSuccess?.();

    if (request.redirectTo) {
      navigate(request.redirectTo);
    }
  }, [request, impact, userId, options, navigate]);

  const modalProps = {
    open,
    onOpenChange: (next: boolean) => {
      if (!executing) {
        setOpen(next);
        if (!next) {
          setRequest(null);
          setImpact(null);
          setError(null);
        }
      }
    },
    impact,
    loading,
    executing,
    error,
    onConfirm: handleConfirm,
  };

  return {
    requestDelete,
    modalProps,
    DestructiveModal: ConfirmDestructiveActionModal,
    isBusy: loading || executing,
  };
}
