"use client";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ChatStatus, FileUIPart } from "@/types/chat";
import {
  CornerDownLeftIcon,
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  FileIcon,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  Image02Icon,
  SourceCodeSquareIcon,
  Zip02Icon,
} from "@hugeicons/core-free-icons";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { nanoid } from "nanoid";
import {
  type ChangeEvent,
  type ChangeEventHandler,
  Children,
  type ClipboardEventHandler,
  type ComponentProps,
  createContext,
  type FormEvent,
  type FormEventHandler,
  Fragment,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Types
// ============================================================================

export type AttachmentsContext = {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
};

export type TextInputContext = {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
};

export type PromptInputControllerProps = {
  textInput: TextInputContext;
  attachments: AttachmentsContext;
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
};

// ============================================================================
// Contexts
// ============================================================================

const PromptInputController = createContext<PromptInputControllerProps | null>(
  null
);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);
const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    );
  }
  return ctx;
};

const useOptionalPromptInputController = () =>
  useContext(PromptInputController);

const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext);

export const usePromptInputAttachments = () => {
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const context = provider ?? local;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
}>;

export function PromptInputProvider({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) {
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  const [attachements, setAttachements] = useState<
    (FileUIPart & { id: string })[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef<() => void>(() => {});

  const add = useCallback(async (files: File[] | FileList) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    // Convert files to data URLs immediately to avoid blob URL lifecycle issues
    const fileDataPromises = incoming.map(async (file) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return {
        id: nanoid(),
        type: "file" as const,
        url: dataUrl,
        mediaType: file.type,
        filename: file.name,
      };
    });

    const fileData = await Promise.all(fileDataPromises);
    setAttachements((prev) => prev.concat(fileData));
  }, []);

  const remove = useCallback((id: string) => {
    setAttachements((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clear = useCallback(() => {
    setAttachements([]);
  }, []);

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      files: attachements,
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef,
    }),
    [attachements, add, remove, clear, openFileDialog]
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    []
  );

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      textInput: {
        value: textInput,
        setInput: setTextInput,
        clear: clearInput,
      },
      attachments,
      __registerFileInput,
    }),
    [textInput, clearInput, attachments, __registerFileInput]
  );

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  );
}

// ============================================================================
// Components
// ============================================================================

export type PromptInputMessage = {
  text: string;
  displayText?: string;
  files: FileUIPart[];
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError"
> & {
  accept?: string;
  multiple?: boolean;
  globalDrop?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>;
};

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const root = anchorRef.current?.closest("form");
    if (root instanceof HTMLFormElement) {
      formRef.current = root;
    }
  }, []);

  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const files = usingProvider ? controller.attachments.files : items;

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") return true;

      const acceptedTypes = accept.split(",").map((t) => t.trim());
      return acceptedTypes.some((type) => {
        if (type.endsWith("/*")) {
          const prefix = type.slice(0, -2);
          return f.type.startsWith(prefix);
        }
        if (type.startsWith(".")) {
          return f.name.toLowerCase().endsWith(type.toLowerCase());
        }
        return f.type === type;
      });
    },
    [accept]
  );

  const addLocal = useCallback(
    async (fileList: File[] | FileList) => {
      const incoming = Array.from(fileList);
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }
      const withinSize = (f: File) =>
        maxFileSize ? f.size <= maxFileSize : true;
      const sized = accepted.filter(withinSize);
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }

      const capacity =
        typeof maxFiles === "number"
          ? Math.max(0, maxFiles - items.length)
          : undefined;
      const capped =
        typeof capacity === "number" ? sized.slice(0, capacity) : sized;
      if (typeof capacity === "number" && sized.length > capacity) {
        onError?.({
          code: "max_files",
          message: "Too many files. Some were not added.",
        });
      }

      // Convert files to data URLs immediately
      const fileDataPromises = capped.map(async (file) => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        return {
          id: nanoid(),
          type: "file" as const,
          url: dataUrl,
          mediaType: file.type,
          filename: file.name,
        };
      });

      const next = await Promise.all(fileDataPromises);
      setItems((prev) => prev.concat(next));
    },
    [matchesAccept, maxFiles, maxFileSize, onError, items.length]
  );

  const add = usingProvider
    ? (files: File[] | FileList) => controller.attachments.add(files)
    : addLocal;

  const remove = usingProvider
    ? (id: string) => controller.attachments.remove(id)
    : (id: string) => setItems((prev) => prev.filter((file) => file.id !== id));

  const clear = usingProvider
    ? () => controller.attachments.clear()
    : () => setItems([]);

  const openFileDialog = usingProvider
    ? () => controller.attachments.openFileDialog()
    : openFileDialogLocal;

  useEffect(() => {
    if (!usingProvider) return;
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  const [isDragging, setIsDragging] = useState(false);
  const [globalIsDragging, setGlobalIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
      }
      setIsDragging(false);
      if (
        !globalDrop &&
        e.dataTransfer.files &&
        e.dataTransfer.files.length > 0
      ) {
        add(e.dataTransfer.files);
      }
    },
    [add, globalDrop]
  );

  useEffect(() => {
    if (!globalDrop) return;

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounterRef.current++;
        setGlobalIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setGlobalIsDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      dragCounterRef.current = 0;
      setGlobalIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
      // Reset the input value so the same file can be selected again
      event.currentTarget.value = "";
    }
  };

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: files.map((item) => ({ ...item, id: item.id })),
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [files, add, remove, clear, openFileDialog]
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const text = usingProvider
      ? controller.textInput.value
      : (() => {
          const formData = new FormData(form);
          return (formData.get("message") as string) || "";
        })();

    if (!usingProvider) {
      form.reset();
    }

    // Files are already data URLs (converted in add function), so just extract without id
    const convertedFiles: FileUIPart[] = files.map(({ id, ...item }) => item);

    // Clear attachments immediately on submit for instant feedback
    clear();
    if (usingProvider) {
      controller.textInput.clear();
    }

    try {
      onSubmit({ text, files: convertedFiles }, event);
    } catch (error) {}
  };

  const inner = (
    <>
      <span aria-hidden="true" className="hidden" ref={anchorRef} />
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form
        className={cn("w-full min-w-0 max-w-full overflow-hidden", className)}
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        {...props}
      >
        <InputGroup
          className={cn(
            "w-full min-w-0 max-w-full overflow-hidden transition-colors duration-200",
            !globalDrop &&
              isDragging &&
              "border-gray-600 bg-muted/50 ring-2 ring-gray-600/20 dark:border-gray-500 dark:ring-gray-500/20"
          )}
        >
          {children}
        </InputGroup>
      </form>
      {globalDrop &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {globalIsDragging && (
              <motion.div
                className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-background/50 px-16 py-12"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="relative flex h-20 w-28 items-center justify-center">
                    <div className="absolute left-0 top-2 flex size-12 -rotate-12 items-center justify-center rounded-xl bg-primary/90 shadow-lg">
                      <HugeiconsIcon icon={File01Icon} className="size-6 text-primary-foreground" />
                    </div>
                    <div className="absolute right-0 top-0 flex size-12 rotate-12 items-center justify-center rounded-xl bg-primary/80 shadow-lg">
                      <HugeiconsIcon icon={SourceCodeSquareIcon} className="size-6 text-primary-foreground" />
                    </div>
                    <div className="absolute bottom-0 left-1/2 z-10 flex size-14 -translate-x-1/2 items-center justify-center rounded-xl bg-primary shadow-lg">
                      <HugeiconsIcon icon={Image02Icon} className="size-7 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-semibold">Add anything</h3>
                    <p className="mt-1 text-muted-foreground">
                      Drop any file here to add it to the conversation
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );

  return usingProvider ? (
    inner
  ) : (
    <LocalAttachmentsContext.Provider value={ctx}>
      {inner}
    </LocalAttachmentsContext.Provider>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  ...props
}: PromptInputBodyProps) => <div className={cn("contents", className)} {...props} />;

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      e.preventDefault();

      const form = e.currentTarget.form;
      const submitButton = form?.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement | null;
      if (submitButton?.disabled) return;

      form?.requestSubmit();
    }

    if (
      e.key === "Backspace" &&
      e.currentTarget.value === "" &&
      attachments.files.length > 0
    ) {
      e.preventDefault();
      const lastAttachment = attachments.files.at(-1);
      if (lastAttachment) {
        attachments.remove(lastAttachment.id);
      }
    }
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      attachments.add(files);
    }
  };

  const controlledProps = controller
    ? {
        value: controller.textInput.value,
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(e.currentTarget.value);
          onChange?.(e);
        },
      }
    : { onChange };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-10", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
      {...controlledProps}
    />
  );
};

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputHeader = ({
  className,
  ...props
}: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first w-full min-w-0 max-w-full flex-wrap gap-1", className)}
    {...props}
  />
);

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("w-full min-w-0 max-w-full justify-between gap-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div className={cn("flex min-w-0 items-center gap-1", className)} {...props} />
);

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  return (
    <InputGroupButton
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export type PromptInputAttachButtonProps = PromptInputButtonProps;

export const PromptInputAttachButton = ({
  className,
  variant = "ghost",
  size,
  children,
  ...props
}: PromptInputAttachButtonProps) => {
  const attachments = usePromptInputAttachments();
  const newSize = size ?? (children ? "sm" : "icon-sm");

  return (
    <PromptInputButton
      className={className}
      onClick={() => attachments.openFileDialog()}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    >
      {children ?? <PaperclipIcon className="size-4" />}
    </PromptInputButton>
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <InputGroupButton
      aria-label="Submit"
      className={cn(className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  );
};

// ============================================================================
// Attachment Components
// ============================================================================

export type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart & { id: string };
  className?: string;
};

export function PromptInputAttachment({
  data,
  className,
}: PromptInputAttachmentProps) {
  const attachments = usePromptInputAttachments();

  const filename = data.filename || "";
  const isImage = data.mediaType?.startsWith("image/") && data.url;

  // Determine file type for non-image files
  const ext = filename.split(".").pop()?.toLowerCase();
  const isSpreadsheet = ext === "xlsx" || ext === "xls" || ext === "csv";
  const isDocument = ext === "docx" || ext === "doc" || ext === "pdf" || ext === "txt";
  const isArchive = ext === "zip";
  const FileTypeIcon = isSpreadsheet ? FileSpreadsheetIcon : isDocument ? FileTextIcon : FileIcon;
  const fileTypeLabel = isArchive ? "Archive" : isSpreadsheet ? "Spreadsheet" : isDocument ? "Document" : "File";
  const iconBgColor = isArchive ? "bg-amber-500" : isSpreadsheet ? "bg-green-500" : "bg-blue-500";

  if (isImage) {
    return (
      <motion.div
        className={cn(
          "group relative flex size-20 flex-shrink-0 cursor-default select-none items-center justify-center overflow-hidden rounded-md",
          className
        )}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      >
        <img
          alt={filename || "attachment"}
          className="size-full object-cover"
          src={data.url}
        />
        <button
          aria-label="Remove attachment"
          className="absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/60 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100 dark:bg-white/60 dark:hover:bg-white/80"
          onClick={(e) => {
            e.stopPropagation();
            attachments.remove(data.id);
          }}
          type="button"
        >
          <XIcon className="size-3 text-white dark:text-black" />
          <span className="sr-only">Remove</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        "group relative flex flex-shrink-0 cursor-default select-none items-center gap-3 rounded-xl bg-muted/50 border border-border p-2 pr-4",
        className
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={`flex size-10 items-center justify-center rounded-lg ${iconBgColor}`}>
        {isArchive ? (
          <HugeiconsIcon icon={Zip02Icon} className="size-5 text-white" />
        ) : (
          <FileTypeIcon className="size-5 text-white" />
        )}
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className="truncate text-sm font-medium max-w-[150px]">
          {filename}
        </span>
        <span className="text-xs text-muted-foreground">
          {fileTypeLabel}
        </span>
      </div>
      <button
        aria-label="Remove attachment"
        className="absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/60 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100 dark:bg-white/60 dark:hover:bg-white/80"
        onClick={(e) => {
          e.stopPropagation();
          attachments.remove(data.id);
        }}
        type="button"
      >
        <XIcon className="size-3 text-white dark:text-black" />
        <span className="sr-only">Remove</span>
      </button>
    </motion.div>
  );
}

export type PromptInputAttachmentsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (attachment: FileUIPart & { id: string }) => ReactNode;
};

export function PromptInputAttachments({
  children,
  className,
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments();

  return (
    <AnimatePresence>
      {attachments.files.length > 0 && (
        <motion.div
          className={cn("flex min-w-0 w-full items-center gap-2 overflow-x-auto overflow-y-hidden p-3", className)}
          initial={{ maxHeight: 0, opacity: 0 }}
          animate={{ maxHeight: 200, opacity: 1 }}
          exit={{ maxHeight: 0, opacity: 0, transition: { delay: 0.15, duration: 0.15 } }}
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="popLayout">
            {attachments.files.map((file) => (
              <Fragment key={file.id}>{children(file)}</Fragment>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Select Components
// ============================================================================

export type PromptInputSelectProps = ComponentProps<typeof Select>;
export const PromptInputSelect = (props: PromptInputSelectProps) => (
  <Select {...props} />
);

export type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>;
export const PromptInputSelectTrigger = ({
  className,
  ...props
}: PromptInputSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    {...props}
  />
);

export type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>;
export const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;
export const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;
export const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
