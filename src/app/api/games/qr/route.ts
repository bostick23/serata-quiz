import { NextRequest, NextResponse } from "next/server";
import { generateQRDataUrl } from "@/lib/utils/qr";

export async function GET(request: NextRequest) {
  const joinCode = request.nextUrl.searchParams.get("joinCode");

  if (!joinCode) {
    return NextResponse.json({ error: "joinCode is required" }, { status: 400 });
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const url = `${baseUrl}/game/${joinCode}/play`;
    const qrDataUrl = await generateQRDataUrl(url);

    return NextResponse.json({ qrDataUrl });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
