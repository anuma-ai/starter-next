"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { XCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchInputProps) {
  return (
    <div className={`relative ${className || ""}`}>
      <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12 pr-12 py-6 border-0 focus-visible:ring-0 rounded-xl bg-white dark:bg-card shadow-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <XCircle size={20} />
        </button>
      )}
    </div>
  );
}
