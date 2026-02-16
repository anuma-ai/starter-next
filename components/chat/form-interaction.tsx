"use client";

import { useState, useCallback, useRef } from "react";
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
  const [activeField, setActiveField] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLElement | null>>({});

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

  const handleRowClick = useCallback((field: FormField) => {
    if (isSubmitting) return;
    if (field.type === "toggle") {
      setValue(field.name, !values[field.name]);
    } else {
      const el = inputRefs.current[field.name];
      if (el) el.focus();
    }
  }, [isSubmitting, setValue, values]);

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
        <div className="rounded-xl bg-sidebar dark:bg-card divide-y divide-border/50">
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
              <div key={field.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                <span className="font-medium text-right">{displayVal}</span>
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
      <div className="rounded-xl bg-sidebar dark:bg-card p-1 mb-3">
        {fields.map((field) => {
          const isStacked = field.type === "textarea" || field.type === "slider";
          const isActive = activeField === field.name;

          return (
            <div
              key={field.name}
              onClick={() => handleRowClick(field)}
              className={cn(
                "px-4 py-3 cursor-pointer rounded-lg transition-all",
                "hover:bg-white/80 dark:hover:bg-muted/50",
                "active:scale-[0.99]",
                isActive && "bg-white/80 dark:bg-muted/50",
                isStacked ? "space-y-2" : "flex items-center gap-3",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Label */}
              <div className={cn(isStacked ? "" : "shrink-0")}>
                <span className="text-base">
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </span>
                {field.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {field.description}
                  </p>
                )}
              </div>

              {/* Input */}
              {field.type === "text" && (
                <input
                  ref={(el) => { inputRefs.current[field.name] = el; }}
                  type="text"
                  value={values[field.name] || ""}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  onFocus={() => setActiveField(field.name)}
                  onBlur={() => setActiveField(null)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  className="flex-1 min-w-0 bg-transparent text-base text-right placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />
              )}

              {field.type === "textarea" && (
                <textarea
                  ref={(el) => { inputRefs.current[field.name] = el; }}
                  value={values[field.name] || ""}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  onFocus={() => setActiveField(field.name)}
                  onBlur={() => setActiveField(null)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 resize-y"
                />
              )}

              {field.type === "select" && (
                <select
                  ref={(el) => { inputRefs.current[field.name] = el; }}
                  value={values[field.name] || ""}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  onFocus={() => setActiveField(field.name)}
                  onBlur={() => setActiveField(null)}
                  disabled={isSubmitting}
                  className={cn(
                    "flex-1 min-w-0 bg-transparent text-base text-right appearance-none focus:outline-none disabled:opacity-50 cursor-pointer",
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
                <div className="flex-1 flex justify-end">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!values[field.name]}
                    onClick={(e) => {
                      e.stopPropagation();
                      setValue(field.name, !values[field.name]);
                    }}
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
                </div>
              )}

              {field.type === "slider" && (
                <div className="flex items-center gap-3">
                  <Slider
                    value={[values[field.name] ?? field.min ?? 0]}
                    min={field.min ?? 0}
                    max={field.max ?? 100}
                    step={field.step ?? 1}
                    disabled={isSubmitting}
                    onValueChange={([v]) => setValue(field.name, v)}
                    className="flex-1"
                  />
                  <span className="text-sm tabular-nums w-10 text-right text-muted-foreground">
                    {values[field.name] ?? field.min ?? 0}
                  </span>
                </div>
              )}

              {field.type === "date" && (
                <div className="flex-1 flex justify-end">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        ref={(el) => { inputRefs.current[field.name] = el; }}
                        type="button"
                        disabled={isSubmitting}
                        onFocus={() => setActiveField(field.name)}
                        onBlur={() => setActiveField(null)}
                        className={cn(
                          "text-base focus:outline-none disabled:opacity-50 cursor-pointer",
                          values[field.name] ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {values[field.name]
                          ? format(new Date(values[field.name]), "PPP")
                          : field.placeholder || "Pick a date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
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
                </div>
              )}
            </div>
          );
        })}
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
