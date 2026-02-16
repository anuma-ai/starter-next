"use client";

import { useState, useCallback } from "react";
import { useUIInteraction } from "@/app/components/ui-interaction-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormFieldOption = {
  value: string;
  label: string;
};

export type FormField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "toggle";
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  defaultValue?: string | boolean;
};

export type FormInteractionProps = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  resolved?: boolean;
  result?: any;
};

function getInitialValues(fields: FormField[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
    } else if (field.type === "toggle") {
      values[field.name] = false;
    } else {
      values[field.name] = "";
    }
  }
  return values;
}

export function FormInteraction({
  id,
  title,
  description,
  fields,
  resolved = false,
  result,
}: FormInteractionProps) {
  const { resolveInteraction, cancelInteraction } = useUIInteraction();
  const [values, setValues] = useState<Record<string, any>>(() =>
    getInitialValues(fields)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedValues, setSubmittedValues] = useState<Record<string, any>>(
    {}
  );

  const setValue = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;

    // Validate required fields
    for (const field of fields) {
      if (field.required && field.type !== "toggle") {
        const val = values[field.name];
        if (!val || (typeof val === "string" && !val.trim())) {
          return;
        }
      }
    }

    setIsSubmitting(true);

    // Clean string values
    const cleaned: Record<string, any> = {};
    for (const field of fields) {
      const val = values[field.name];
      cleaned[field.name] =
        typeof val === "string" ? val.trim() : val;
    }

    setSubmittedValues(cleaned);
    setSubmitted(true);
    resolveInteraction(id, { values: cleaned });
  }, [id, fields, values, resolveInteraction, isSubmitting]);

  const handleCancel = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    cancelInteraction(id);
  }, [id, cancelInteraction, isSubmitting]);

  // Summary view after submission
  if (submitted || resolved) {
    const displayValues =
      resolved && result?.values ? result.values : submittedValues;

    return (
      <div className="my-4 max-w-2xl">
        <div className="mb-2">
          <h3 className="text-base font-medium text-muted-foreground">
            {title}
          </h3>
        </div>
        <div className="rounded-xl bg-sidebar dark:bg-card px-4 py-3 space-y-1">
          {fields.map((field) => {
            const val = displayValues[field.name];
            if (val === undefined || val === "" || val === false) return null;
            const displayVal =
              field.type === "toggle"
                ? "Yes"
                : field.type === "select"
                  ? field.options?.find((o) => o.value === val)?.label || val
                  : val;
            return (
              <div key={field.name} className="text-base">
                <span className="text-muted-foreground">{field.label}:</span>{" "}
                <span className="font-medium">{displayVal}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 max-w-2xl">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-base font-medium">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {/* Fields */}
      <div className="rounded-xl bg-sidebar dark:bg-card p-4 mb-3 space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="text-sm font-medium block mb-1">
              {field.label}
              {field.required && (
                <span className="text-destructive ml-0.5">*</span>
              )}
            </label>
            {field.description && (
              <p className="text-xs text-muted-foreground mb-1.5">
                {field.description}
              </p>
            )}

            {field.type === "text" && (
              <input
                type="text"
                value={values[field.name] || ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
            )}

            {field.type === "textarea" && (
              <textarea
                value={values[field.name] || ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={isSubmitting}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 resize-y"
              />
            )}

            {field.type === "select" && (
              <select
                value={values[field.name] || ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                disabled={isSubmitting}
                className={cn(
                  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
                  !values[field.name] && "text-muted-foreground"
                )}
              >
                <option value="">
                  {field.placeholder || "Select..."}
                </option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === "toggle" && (
              <button
                type="button"
                role="switch"
                aria-checked={!!values[field.name]}
                onClick={() => setValue(field.name, !values[field.name])}
                disabled={isSubmitting}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  values[field.name] ? "bg-primary" : "bg-input"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    values[field.name] ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer buttons */}
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
            isSubmitting ||
            fields.some(
              (f) =>
                f.required &&
                f.type !== "toggle" &&
                (!values[f.name] ||
                  (typeof values[f.name] === "string" &&
                    !values[f.name].trim()))
            )
          }
          size="sm"
          className="rounded-lg [corner-shape:round]"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}
