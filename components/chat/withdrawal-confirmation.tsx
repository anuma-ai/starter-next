"use client";

import { useState, useCallback } from "react";
import { useUIInteraction } from "@anuma/sdk/react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export type WithdrawalConfirmationProps = {
  id: string;
  amount: string;
  zrc20: string;
  tokenSymbol?: string;
  receiver: string;
  from: string;
  resolved?: boolean;
  result?: any;
};

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WithdrawalConfirmation({
  id,
  amount,
  zrc20,
  tokenSymbol,
  receiver,
  from,
  resolved = false,
  result,
}: WithdrawalConfirmationProps) {
  const { resolveInteraction, cancelInteraction } = useUIInteraction();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wasConfirmed, setWasConfirmed] = useState(false);

  const handleConfirm = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setWasConfirmed(true);
    setSubmitted(true);
    resolveInteraction(id, { confirmed: true });
  }, [id, resolveInteraction, isSubmitting]);

  const handleReject = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitted(true);
    cancelInteraction(id);
  }, [id, cancelInteraction, isSubmitting]);

  const tokenLabel = tokenSymbol || truncateAddress(zrc20);

  if (resolved || submitted) {
    const confirmed = resolved
      ? (result?.confirmed || result?.success)
      : wasConfirmed;
    const cancelled = result?.cancelled;
    const failed = resolved && result?.success === false && !cancelled;

    return (
      <div className="my-4 max-w-2xl">
        <div className="mb-2">
          <h3 className="text-base font-medium text-muted-foreground">
            Withdraw {amount} {tokenLabel}
          </h3>
        </div>
        <div className="rounded-xl bg-sidebar dark:bg-card px-4 py-3">
          {confirmed && !failed ? (
            <div className="flex items-center gap-2">
              <Check className="size-4 flex-shrink-0" />
              <span className="text-base font-medium">Confirmed</span>
            </div>
          ) : failed ? (
            <div className="flex items-center gap-2">
              <X className="size-4 flex-shrink-0" />
              <span className="text-base font-medium">Failed</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <X className="size-4 flex-shrink-0" />
              <span className="text-base font-medium">Rejected</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pending state: show full transaction details with confirm/reject
  return (
    <div className="my-4 max-w-2xl">
      <div className="mb-3">
        <h3 className="text-base font-medium">Confirm withdrawal</h3>
      </div>

      <div className="rounded-xl bg-sidebar dark:bg-card p-4 mb-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Amount</span>
          <span className="text-base font-medium">{amount} {tokenLabel}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">From</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">{truncateAddress(from)}</span>
            <span className="text-sm text-foreground">(ZetaChain)</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">To</span>
          <span className="text-sm font-mono">{truncateAddress(receiver)}</span>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReject}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          Reject
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting}
          size="sm"
          className="cursor-pointer rounded-lg [corner-shape:round]"
        >
          {isSubmitting ? "Confirming..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
