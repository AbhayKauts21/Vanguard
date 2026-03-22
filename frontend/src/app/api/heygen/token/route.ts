import { NextResponse } from "next/server";

export async function POST() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API token not configured." },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `HeyGen Token Creation Failed: ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    
    if (!data?.data?.token) {
      return NextResponse.json(
        { error: "Invalid payload shape returned by HeyGen" },
        { status: 500 }
      );
    }

    return NextResponse.json({ token: data.data.token });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: `Internal Routing Exception: ${error.message}` },
      { status: 500 }
    );
  }
}
