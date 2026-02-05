"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Delete01Icon, MoreHorizontalIcon, Message01Icon, Download01Icon } from "@hugeicons/core-free-icons";
import { ImageIcon, FileTextIcon, FileSpreadsheetIcon, FileIcon, LayoutGridIcon, ListIcon, ArrowUpIcon, ArrowDownIcon, CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useFiles,
  type StoredMedia,
} from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";
import { useChatContext } from "@/app/components/chat-provider";

// Extended file type that includes SDK metadata plus blob URL for rendering
interface FileWithBlobUrl extends StoredMedia {
  blobUrl: string;
}

type ViewMode = "grid" | "list";
type SortOption = "date" | "name" | "size";
type SortDirection = "asc" | "desc";

function getFileIcon(mimeType: string, filename: string) {
  if (mimeType.startsWith("image/")) {
    return { Icon: ImageIcon, color: "text-purple-500" };
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return { Icon: FileSpreadsheetIcon, color: "text-green-500" };
  }
  if (ext === "pdf") {
    return { Icon: FileTextIcon, color: "text-red-500" };
  }
  if (["docx", "doc", "txt"].includes(ext)) {
    return { Icon: FileTextIcon, color: "text-blue-500" };
  }
  return { Icon: FileIcon, color: "text-gray-500" };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesView() {
  const router = useRouter();
  const database = useDatabase();
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;
  const { encryptionReady } = useChatContext();

  const [files, setFiles] = useState<FileWithBlobUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileWithBlobUrl | null>(null);

  // Use SDK's useFiles hook for file management
  const {
    isReady,
    getRecentMedia,
    createBlobUrl,
    deleteMedia,
  } = useFiles({
    database,
    walletAddress,
  });

  const loadFiles = useCallback(async () => {
    // Wait for encryption to be ready before loading files
    // Files are stored encrypted in OPFS and require the encryption key to read
    if (!walletAddress || !isReady || !encryptionReady) {
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get all recent media files
      const mediaFiles = await getRecentMedia(100);

      // Create blob URLs for all files
      const filesWithBlobUrls = await Promise.all(
        mediaFiles.map(async (file) => {
          let blobUrl = "";

          try {
            const url = await createBlobUrl(file.mediaId);
            if (url) {
              blobUrl = url;
            }
          } catch (err) {
            console.debug(`File ${file.mediaId} could not be loaded`);
          }

          return {
            ...file,
            blobUrl,
          };
        })
      );

      // Filter out files without blob URLs (can't be displayed)
      setFiles(filesWithBlobUrls.filter((f) => f.blobUrl));
    } finally {
      setLoading(false);
    }
  }, [getRecentMedia, createBlobUrl, walletAddress, isReady, encryptionReady]);

  // Load files when ready (requires both database and encryption to be initialized)
  useEffect(() => {
    if (isReady && walletAddress && encryptionReady) {
      loadFiles();
    }
  }, [isReady, walletAddress, encryptionReady, loadFiles]);

  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((file) => {
        return (
          file.name.toLowerCase().includes(query) ||
          file.mimeType.toLowerCase().includes(query)
        );
      });
    }

    // Sort files
    const sorted = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "date":
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [files, searchQuery, sortBy, sortDirection]);

  const handleSortClick = (option: SortOption) => {
    if (sortBy === option) {
      // Toggle direction if clicking the same option
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // Set new sort option with default direction
      setSortBy(option);
      setSortDirection("desc");
    }
  };

  const handleDeleteClick = (file: FileWithBlobUrl) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (fileToDelete) {
      try {
        await deleteMedia(fileToDelete.mediaId);
      } catch (err) {
        console.error("Failed to delete file:", err);
      }

      setFiles((prev) => prev.filter((f) => f.mediaId !== fileToDelete.mediaId));
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const handleShowInChat = (file: FileWithBlobUrl) => {
    if (file.conversationId) {
      router.push(`/c/${file.conversationId}`);
    }
  };

  const handleDownload = (file: FileWithBlobUrl) => {
    const link = document.createElement("a");
    link.href = file.blobUrl;
    link.download = file.name || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Files</h1>
          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="flex items-center bg-white dark:bg-card rounded-lg p-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                  >
                    {sortDirection === "asc" ? (
                      <ArrowUpIcon className="size-4 mr-2" />
                    ) : (
                      <ArrowDownIcon className="size-4 mr-2" />
                    )}
                    {sortBy === "date" ? "Date" : sortBy === "name" ? "Name" : "Size"}
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSortClick("date")}>
                  <CheckIcon className={`size-4 mr-2 ${sortBy === "date" ? "" : "invisible"}`} />
                  <div className="flex flex-col">
                    <span>Date</span>
                    {sortBy === "date" && (
                      <span className="text-xs text-muted-foreground">
                        {sortDirection === "asc" ? "Ascending" : "Descending"}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortClick("name")}>
                  <CheckIcon className={`size-4 mr-2 ${sortBy === "name" ? "" : "invisible"}`} />
                  <div className="flex flex-col">
                    <span>Name</span>
                    {sortBy === "name" && (
                      <span className="text-xs text-muted-foreground">
                        {sortDirection === "asc" ? "Ascending" : "Descending"}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortClick("size")}>
                  <CheckIcon className={`size-4 mr-2 ${sortBy === "size" ? "" : "invisible"}`} />
                  <div className="flex flex-col">
                    <span>Size</span>
                    {sortBy === "size" && (
                      <span className="text-xs text-muted-foreground">
                        {sortDirection === "asc" ? "Ascending" : "Descending"}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-white dark:bg-card rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                className={`h-8 w-8 p-0 ${viewMode === "grid" ? "bg-muted" : ""}`}
                aria-label="Grid view"
              >
                <LayoutGridIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                className={`h-8 w-8 p-0 ${viewMode === "list" ? "bg-muted" : ""}`}
                aria-label="List view"
              >
                <ListIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>

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

        {loading || (walletAddress && !encryptionReady) ? (
          <div className="text-center text-muted-foreground py-8">
            {!encryptionReady && walletAddress ? "Initializing encryption..." : "Loading files..."}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-card p-8">
            <p className="text-center text-muted-foreground">
              {searchQuery
                ? "No files match your search"
                : "No files stored yet"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.map((file) => {
              const { Icon, color } = getFileIcon(file.mimeType, file.name);
              const isImage = file.mimeType.startsWith("image/");
              const date = new Date(file.createdAt);
              const formattedDate = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={file.mediaId}
                  className="group relative rounded-xl bg-white dark:bg-card overflow-hidden transition-transform duration-200 hover:scale-[1.02]"
                >
                  {/* Preview area */}
                  <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={file.blobUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className={`size-12 ${color}`} />
                    )}
                  </div>

                  {/* File info */}
                  <div className="p-3">
                    <p className="font-medium truncate text-sm">
                      {file.name || "Unnamed file"}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formattedDate}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>

                  {/* Context menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 cursor-pointer"
                        aria-label="More options"
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                      >
                        <HugeiconsIcon icon={Download01Icon} size={16} className="mr-2" />
                        Download
                      </DropdownMenuItem>
                      {file.conversationId && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowInChat(file);
                          }}
                        >
                          <HugeiconsIcon icon={Message01Icon} size={16} className="mr-2" />
                          Show in chat
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(file);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={16} className="mr-2 text-destructive" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-card overflow-hidden">
            {filteredFiles.map((file, index) => {
              const { Icon, color } = getFileIcon(file.mimeType, file.name);
              const isImage = file.mimeType.startsWith("image/");
              const date = new Date(file.createdAt);
              const formattedDate = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={file.mediaId}
                  className={`group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors ${
                    index !== filteredFiles.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  {/* Thumbnail / Icon */}
                  <div className="size-12 rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                    {isImage ? (
                      <img
                        src={file.blobUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className={`size-6 ${color}`} />
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {file.name || "Unnamed file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formattedDate} · {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Context menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted hover:text-foreground cursor-pointer"
                        aria-label="More options"
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                      >
                        <HugeiconsIcon icon={Download01Icon} size={16} className="mr-2" />
                        Download
                      </DropdownMenuItem>
                      {file.conversationId && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowInChat(file);
                          }}
                        >
                          <HugeiconsIcon icon={Message01Icon} size={16} className="mr-2" />
                          Show in chat
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(file);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={16} className="mr-2 text-destructive" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{fileToDelete?.name || "this file"}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
