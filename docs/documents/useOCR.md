# Extracting Text from Images

The `useOCR` hook from `@reverbia/sdk/react` provides Optical Character
Recognition (OCR) capabilities. It extracts text from images and scanned
documents, and can serve as a fallback when PDF text extraction is insufficient.

## Hook Initialization

```ts
const { extractOCRContext, isProcessing, error } = useOCR();
```

## Extracting Text from Images

```ts
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
```
