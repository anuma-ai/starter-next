"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useUIInteraction } from "@/app/components/ui-interaction-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type FormFieldOption = {
  value: string;
  label: string;
};

export type FormField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "toggle" | "date" | "slider";
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  defaultValue?: string | boolean | number;
  min?: number;
  max?: number;
  step?: number;
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
    } else if (field.type === "slider") {
      values[field.name] = field.min ?? 0;
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
      if (field.required && field.type !== "toggle" && field.type !== "slider") {
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
            if (val === undefined || val === "" || val === false || (field.type !== "slider" && val === 0)) return null;
            const displayVal =
              field.type === "toggle"
                ? "Yes"
                : field.type === "date"
                  ? format(new Date(val), "PPP")
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

            {field.type === "slider" && (
              <div className="flex items-center gap-3 pt-1">
                <Slider
                  value={[values[field.name] ?? field.min ?? 0]}
                  min={field.min ?? 0}
                  max={field.max ?? 100}
                  step={field.step ?? 1}
                  disabled={isSubmitting}
                  onValueChange={([v]) => setValue(field.name, v)}
                  className="flex-1"
                />
                <span className="text-sm tabular-nums w-10 text-right">
                  {values[field.name] ?? field.min ?? 0}
                </span>
              </div>
            )}

            {field.type === "date" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isSubmitting}
                    data-empty={!values[field.name]}
                    className="data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="size-4" />
                    {values[field.name]
                      ? format(new Date(values[field.name]), "PPP")
                      : <span>{field.placeholder || "Pick a date"}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      values[field.name]
                        ? new Date(values[field.name])
                        : undefined
                    }
                    onSelect={(date) =>
                      setValue(
                        field.name,
                        date ? date.toISOString().split("T")[0] : ""
                      )
                    }
                  />
                </PopoverContent>
              </Popover>
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
                f.type !== "slider" &&
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
