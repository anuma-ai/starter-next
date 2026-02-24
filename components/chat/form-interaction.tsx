"use client";

import { useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useUIInteraction } from "@anuma/sdk/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [openDateField, setOpenDateField] = useState<string | null>(null);
  const [openSelectField, setOpenSelectField] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLElement | null>>({});

  const setValue = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;

    setIsSubmitting(true);

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
    } else if (field.type === "date") {
      setOpenDateField(field.name);
    } else if (field.type === "select") {
      setOpenSelectField(field.name);
    } else {
      const el = inputRefs.current[field.name];
      if (el) el.focus();
    }
  }, [isSubmitting, setValue, values]);

  if (submitted || resolved) {
    const displayValues =
      resolved && result?.values ? result.values : submittedValues;

    return (
      <div className="my-4 max-w-2xl">
        <div className="mb-2">
          <h3 className="text-base font-medium text-muted-foreground dark:text-white/40">
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
                <span className="text-muted-foreground dark:text-white/40">{field.label}</span>
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
      <div className="mb-3">
        <h3 className="text-base font-medium">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground dark:text-white/40 mt-1">{description}</p>
        )}
      </div>

      <div className="rounded-xl bg-sidebar dark:bg-card p-1 mb-3 flex flex-col gap-0.5">
        {fields.map((field) => {
          const isStacked = field.type === "slider";
          const isActive = activeField === field.name || openDateField === field.name || openSelectField === field.name;

          return (
            <div
              key={field.name}
              onClick={() => handleRowClick(field)}
              className={cn(
                "px-4 py-3 cursor-pointer rounded-lg transition-all",
                "hover:bg-white/80 dark:hover:bg-muted/50",
                "active:scale-[0.99]",
                isActive && "bg-white/40 dark:bg-muted/30",
                isStacked ? "space-y-2" : field.type === "textarea" ? "flex items-start gap-3" : "flex items-center gap-3",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(isStacked ? "" : "shrink-0")}>
                <span className="text-base">
                  {field.label}
                </span>
                {field.description && (
                  <p className="text-sm text-muted-foreground dark:text-white/40 mt-0.5">
                    {field.description}
                  </p>
                )}
              </div>

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
                  className="flex-1 min-w-0 bg-transparent text-base text-right text-foreground/70 dark:text-white/70 placeholder:text-muted-foreground dark:placeholder:text-white/40 focus:outline-none disabled:opacity-50"
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
                  rows={2}
                  className="flex-1 min-w-0 bg-transparent text-base text-right text-foreground/70 dark:text-white/70 placeholder:text-muted-foreground dark:placeholder:text-white/40 focus:outline-none disabled:opacity-50 resize-none"
                />
              )}

              {field.type === "select" && (
                <div className="flex-1 flex justify-end">
                  <Select
                    value={values[field.name] || ""}
                    onValueChange={(val) => setValue(field.name, val)}
                    disabled={isSubmitting}
                    open={openSelectField === field.name}
                    onOpenChange={(open) =>
                      setOpenSelectField(open ? field.name : null)
                    }
                  >
                    <SelectTrigger
                      className="border-0 shadow-none bg-transparent dark:bg-transparent dark:hover:bg-transparent text-base text-foreground/70 dark:text-white/70 p-0 h-auto min-h-0 focus:ring-0 cursor-pointer [&>svg]:text-muted-foreground dark:[&>svg]:text-white/30 dark:data-[placeholder]:text-white/40"
                    >
                      <SelectValue placeholder={field.placeholder || "Select..."} />
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border dark:border-border dark:[box-shadow:0_10px_38px_-10px_rgba(0,0,0,0.5),0_10px_20px_-15px_rgba(0,0,0,0.4)]"
                    >
                      <SelectGroup>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
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
                    className="flex-1 [&_[data-slot=slider-range]]:bg-neutral-500 [&_[data-slot=slider-thumb]]:border-neutral-500 dark:[&_[data-slot=slider-range]]:bg-white/50 dark:[&_[data-slot=slider-thumb]]:border-white/50 dark:[&_[data-slot=slider-track]]:bg-white/15"
                  />
                  <span className="text-sm tabular-nums w-10 text-right text-muted-foreground dark:text-white/40">
                    {values[field.name] ?? field.min ?? 0}
                  </span>
                </div>
              )}

              {field.type === "date" && (
                <div className="flex-1 flex justify-end">
                  <Popover
                    open={openDateField === field.name}
                    onOpenChange={(open) =>
                      setOpenDateField(open ? field.name : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className={cn(
                          "text-base focus:outline-none disabled:opacity-50 cursor-pointer",
                          values[field.name] ? "text-foreground/70 dark:text-white/70" : "text-muted-foreground dark:text-white/40"
                        )}
                      >
                        {values[field.name]
                          ? format(new Date(values[field.name]), "PPP")
                          : field.placeholder || "Pick a date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:bg-card dark:border dark:border-border dark:[box-shadow:0_10px_38px_-10px_rgba(0,0,0,0.5),0_10px_20px_-15px_rgba(0,0,0,0.4)]"
                      align="end"
                      onFocusOutside={(e) => e.preventDefault()}
                    >
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        fromYear={new Date().getFullYear() - 100}
                        toYear={new Date().getFullYear() + 10}
                        selected={
                          values[field.name]
                            ? new Date(values[field.name])
                            : undefined
                        }
                        onSelect={(date) => {
                          setValue(
                            field.name,
                            date ? date.toISOString().split("T")[0] : ""
                          );
                          setOpenDateField(null);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="sm"
          className="rounded-lg [corner-shape:round] cursor-pointer"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}
