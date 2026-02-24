"use client";

import { useState, useCallback } from "react";
import { useUIInteraction } from "@anuma/sdk/react";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
};

export type ChoiceInteractionProps = {
  id: string;
  title: string;
  description?: string;
  options: ChoiceOption[];
  allowMultiple?: boolean;
  resolved?: boolean;
  result?: any;
};

export function ChoiceInteraction({
  id,
  title,
  description,
  options,
  allowMultiple = false,
  resolved = false,
  result,
}: ChoiceInteractionProps) {
  const { resolveInteraction, cancelInteraction } = useUIInteraction();
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string[]>([]);

  const handleOptionClick = useCallback(
    (value: string) => {
      if (isSubmitting) return;

      setSelectedValues((prev) => {
        const next = new Set(prev);
        if (allowMultiple) {
          if (next.has(value)) {
            next.delete(value);
          } else {
            next.add(value);
          }
        } else {
          next.clear();
          next.add(value);
        }
        return next;
      });
    },
    [allowMultiple, isSubmitting]
  );

  const handleSubmit = useCallback(() => {
    if (selectedValues.size === 0 || isSubmitting) return;
    if (selectedValues.has("__other__") && !otherText.trim()) return;

    setIsSubmitting(true);

    let finalValues = Array.from(selectedValues);

    if (selectedValues.has("__other__")) {
      finalValues = finalValues.map(v => v === "__other__" ? otherText.trim() : v);
    }

    setSubmittedAnswer(finalValues);
    setSubmitted(true);

    const result = allowMultiple
      ? { selected: finalValues }
      : { selected: finalValues[0] };

    resolveInteraction(id, result);
  }, [id, selectedValues, allowMultiple, resolveInteraction, isSubmitting, otherText]);

  const handleCancel = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    cancelInteraction(id);
  }, [id, cancelInteraction, isSubmitting]);

  if (submitted || resolved) {
    const answer = resolved && result
      ? (Array.isArray(result.selected) ? result.selected : [result.selected])
      : submittedAnswer;

    return (
      <div className="my-4 max-w-2xl">
        <div className="mb-2">
          <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
        </div>
        <div className="rounded-xl bg-sidebar dark:bg-card px-4 py-3">
          <div className="text-base font-medium">
            {answer.join(", ")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 max-w-2xl">
      <div className="mb-3">
        <h3 className="text-base font-medium">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      <div className="rounded-xl bg-sidebar dark:bg-card p-1 mb-3">
        {options.map((option) => {
          const isSelected = selectedValues.has(option.value);
          return (
            <div
              key={option.value}
              onClick={() => !isSubmitting && handleOptionClick(option.value)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 cursor-pointer rounded-lg transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:bg-white/80 dark:hover:bg-muted/50",
                "active:scale-[0.99]",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center pt-1">
                {allowMultiple ? (
                  <div
                    className={cn(
                      "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background flex items-center justify-center",
                      isSelected && "bg-primary text-primary-foreground"
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "h-4 w-4 shrink-0 rounded-full border border-primary ring-offset-background flex items-center justify-center"
                    )}
                  >
                    {isSelected && <Circle className="h-2.5 w-2.5 fill-current text-primary" />}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-0.5">
                <span className="text-base">{option.label}</span>
                {option.description && (
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div
          onClick={() => !isSubmitting && handleOptionClick("__other__")}
          className={cn(
            "flex w-full items-start gap-3 px-4 py-3 cursor-pointer rounded-lg transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "hover:bg-white/80 dark:hover:bg-muted/50",
            "active:scale-[0.99]",
            isSubmitting && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center pt-1">
            {allowMultiple ? (
              <div
                className={cn(
                  "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background flex items-center justify-center",
                  selectedValues.has("__other__") && "bg-primary text-primary-foreground"
                )}
              >
                {selectedValues.has("__other__") && <Check className="h-4 w-4" />}
              </div>
            ) : (
              <div
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full border border-primary ring-offset-background flex items-center justify-center"
                )}
              >
                {selectedValues.has("__other__") && <Circle className="h-2.5 w-2.5 fill-current text-primary" />}
              </div>
            )}
          </div>

          <div className="flex-1">
            <input
              type="text"
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value);
                if (e.target.value && !selectedValues.has("__other__")) {
                  handleOptionClick("__other__");
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!selectedValues.has("__other__")) {
                  handleOptionClick("__other__");
                }
              }}
              placeholder="Please specify..."
              disabled={isSubmitting}
              className="w-full px-0 py-0 text-base bg-transparent focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            selectedValues.size === 0 ||
            isSubmitting ||
            (selectedValues.has("__other__") && !otherText.trim())
          }
          size="sm"
          className="rounded-lg [corner-shape:round]"
        >
          {isSubmitting ? "Confirming..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
