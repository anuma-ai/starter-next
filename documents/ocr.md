# Extracting Text from Images

The `useOCR` hook from `@reverbia/sdk/react` provides Optical Character
Recognition (OCR) capabilities. It extracts text from images and scanned
documents, and can serve as a fallback when PDF text extraction is insufficient.

## Hook Initialization

{@includeCode ../hooks/useAppOCR.ts#hookInit}

## Extracting Text from Images

{@includeCode ../hooks/useAppOCR.ts#extractFromImages}
