"use client";

import { useCallback, useState } from "react";
import { useOCR } from "@reverbia/sdk/react";

/**
 * useOCR Hook Example
 *
 * The useOCR hook provides Optical Character Recognition (OCR) capabilities.
 * It can extract text from images, scanned documents, and serves as a
 * fallback when PDF text extraction is insufficient.
 */

type FileAttachment = {
  url: string;
  filename: string;
  mediaType: string;
};

type ExtractedOCR = {
  filename: string;
  content: string;
  timestamp: number;
};

export function useAppOCR() {
  const [extractedTexts, setExtractedTexts] = useState<ExtractedOCR[]>([]);

  //#region hookInit
  const { extractOCRContext, isProcessing, error } = useOCR();
  //#endregion hookInit

  //#region extractFromImages
  const extractFromImages = useCallback(
    async (files: FileAttachment[]) => {
      const imageFiles = files.filter((f) => f.mediaType.startsWith("image/"));

      if (imageFiles.length === 0) {
        console.log("No image files to process");
        return null;
      }

      const context = await extractOCRContext(imageFiles);

      if (context && context.length > 0) {
        imageFiles.forEach((file) => {
          setExtractedTexts((prev) => [
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
    [extractOCRContext]
  );
  //#endregion extractFromImages

  const extractFromAnyFiles = useCallback(
    async (files: FileAttachment[]) => {
      const context = await extractOCRContext(files);

      if (context && context.length > 0) {
        files.forEach((file) => {
          setExtractedTexts((prev) => [
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
    [extractOCRContext]
  );

  const clearHistory = useCallback(() => {
    setExtractedTexts([]);
  }, []);

  return {
    extractFromImages,
    extractFromAnyFiles,
    extractedTexts,
    isProcessing,
    error,
    clearHistory,
  };
}
