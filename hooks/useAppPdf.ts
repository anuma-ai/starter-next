"use client";

import { useCallback, useState } from "react";
import { usePdf } from "@reverbia/sdk/react";

/**
 * usePdf Hook Example
 *
 * The usePdf hook provides PDF text extraction capabilities.
 * It can extract text content from PDF files for use in chat context
 * or other processing.
 */

type FileAttachment = {
  url: string;
  filename: string;
  mediaType: string;
};

type ExtractedPdf = {
  filename: string;
  content: string;
  timestamp: number;
};

export function useAppPdf() {
  const [extractedPdfs, setExtractedPdfs] = useState<ExtractedPdf[]>([]);

  //#region hookInit
  const { extractPdfContext, isProcessing, error } = usePdf();
  //#endregion hookInit

  //#region extractFromPdfs
  const extractFromPdfs = useCallback(
    async (files: FileAttachment[]) => {
      const pdfFiles = files.filter(
        (f) =>
          f.mediaType === "application/pdf" ||
          f.filename.toLowerCase().endsWith(".pdf")
      );

      if (pdfFiles.length === 0) {
        console.log("No PDF files to extract");
        return null;
      }

      const context = await extractPdfContext(pdfFiles);

      if (context && context.length > 0) {
        pdfFiles.forEach((file) => {
          setExtractedPdfs((prev) => [
            {
              filename: file.filename,
              content: context,
              timestamp: Date.now(),
            },
            ...prev,
          ]);
        });

        return context;
      }

      return null;
    },
    [extractPdfContext]
  );
  //#endregion extractFromPdfs

  const hasMinimumContent = useCallback(
    (content: string | null, minLength: number = 100) => {
      return content !== null && content.length >= minLength;
    },
    []
  );

  const clearHistory = useCallback(() => {
    setExtractedPdfs([]);
  }, []);

  return {
    extractFromPdfs,
    hasMinimumContent,
    extractedPdfs,
    isProcessing,
    error,
    clearHistory,
  };
}
