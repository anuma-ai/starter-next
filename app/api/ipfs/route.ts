import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;

export async function GET() {
  return NextResponse.json({ enabled: !!PINATA_JWT });
}

export async function POST(req: NextRequest) {
  if (!PINATA_JWT) {
    return NextResponse.json(
      { error: "PINATA_JWT not configured" },
      { status: 500 }
    );
  }

  const { imageUrl } = await req.json();
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json(
      { error: "imageUrl is required" },
      { status: 400 }
    );
  }

  // Fetch the image
  let imageRes: Response;
  try {
    imageRes = await fetch(imageUrl);
  } catch (err: any) {
    console.error("Failed to fetch image:", err);
    return NextResponse.json(
      { error: `Failed to fetch image: ${err.message}` },
      { status: 502 }
    );
  }

  if (!imageRes.ok) {
    console.error("Image fetch returned", imageRes.status, imageRes.statusText);
    return NextResponse.json(
      { error: `Image fetch failed: ${imageRes.status} ${imageRes.statusText}` },
      { status: 502 }
    );
  }

  const blob = await imageRes.blob();
  const contentType = imageRes.headers.get("content-type") || "image/png";
  const ext = contentType.split("/")[1]?.split(";")[0] || "png";

  // Upload to Pinata (v3 API)
  const form = new FormData();
  form.append("file", new File([blob], `nft.${ext}`, { type: contentType }));
  form.append("network", "public");

  let pinataRes: Response;
  try {
    pinataRes = await fetch(
      "https://uploads.pinata.cloud/v3/files",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: form,
      }
    );
  } catch (err: any) {
    console.error("Pinata request failed:", err);
    return NextResponse.json(
      { error: `Pinata request failed: ${err.message}` },
      { status: 502 }
    );
  }

  if (!pinataRes.ok) {
    const text = await pinataRes.text();
    console.error("Pinata upload failed:", pinataRes.status, text);
    return NextResponse.json(
      { error: `Pinata upload failed (${pinataRes.status}): ${text}` },
      { status: 502 }
    );
  }

  const { data } = await pinataRes.json();

  return NextResponse.json({ ipfsUrl: `ipfs://${data.cid}` });
}
