The `usePdf` hook from `@reverbia/sdk/react` provides PDF text extraction
capabilities. It extracts text content from PDF files for use in chat context or
other processing.

## Hook Initialization

```ts
const { extractPdfContext, isProcessing, error } = usePdf();
```

## Extracting Text from PDFs

```ts
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
```
