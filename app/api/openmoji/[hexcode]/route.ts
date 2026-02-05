import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

// Validate hexcode format (uppercase hex characters only)
const HEXCODE_REGEX = /^[A-Fa-f0-9]+$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hexcode: string }> }
) {
  const { hexcode } = await params;

  // Validate hexcode format to prevent path traversal
  if (!HEXCODE_REGEX.test(hexcode)) {
    return NextResponse.json({ error: "Invalid hexcode" }, { status: 400 });
  }

  try {
    const svgPath = join(
      process.cwd(),
      "node_modules",
      "openmoji",
      "black",
      "svg",
      `${hexcode}.svg`
    );

    const content = await readFile(svgPath, "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "SVG not found" }, { status: 404 });
  }
}
