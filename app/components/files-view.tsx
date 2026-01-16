"use client";

import { useState, useEffect, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { ImageIcon, FileTextIcon, FileSpreadsheetIcon, FileIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAllFiles, deleteFile, type StoredFile } from "@/lib/fileStorage";

function getFileIcon(mimeType: string, filename: string) {
  if (mimeType.startsWith("image/")) {
    return { Icon: ImageIcon, color: "text-purple-500" };
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return { Icon: FileSpreadsheetIcon, color: "text-green-500" };
  }
  if (["docx", "doc", "pdf", "txt"].includes(ext)) {
    return { Icon: FileTextIcon, color: "text-blue-500" };
  }
  return { Icon: FileIcon, color: "text-gray-500" };
}

function formatFileSize(dataUrl: string): string {
  // Estimate size from base64 data URL
  const base64 = dataUrl.split(",")[1] || "";
  const bytes = Math.round((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesView() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    setLoading(true);
    try {
      const allFiles = await getAllFiles();
      setFiles(allFiles);
    } finally {
      setLoading(false);
    }
  }

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) {
      return files;
    }
    const query = searchQuery.toLowerCase();
    return files.filter((file) => {
      return (
        file.filename.toLowerCase().includes(query) ||
        file.mimeType.toLowerCase().includes(query)
      );
    });
  }, [files, searchQuery]);

  const handleDelete = async (id: string) => {
    await deleteFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDownload = (file: StoredFile) => {
    const link = document.createElement("a");
    link.href = file.dataUrl;
    link.download = file.filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 text-2xl font-semibold">Files</h1>

        <div className="relative mb-6">
          <HugeiconsIcon
            icon={Search01Icon}
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 py-6 border-0 focus-visible:ring-0 rounded-xl bg-white dark:bg-card shadow-none"
          />
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-8">
            Loading files...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-card p-8">
            <p className="text-center text-muted-foreground">
              {searchQuery
                ? "No files match your search"
                : "No files stored yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.map((file) => {
              const { Icon, color } = getFileIcon(file.mimeType, file.filename);
              const isImage = file.mimeType.startsWith("image/");
              const date = new Date(file.createdAt);
              const formattedDate = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={file.id}
                  className="group relative rounded-xl bg-white dark:bg-card overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer"
                  onClick={() => handleDownload(file)}
                >
                  {/* Preview area */}
                  <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={file.dataUrl}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className={`size-12 ${color}`} />
                    )}
                  </div>

                  {/* File info */}
                  <div className="p-3">
                    <p className="font-medium truncate text-sm">
                      {file.filename || "Unnamed file"}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formattedDate}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.dataUrl)}
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                    aria-label="Delete file"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
