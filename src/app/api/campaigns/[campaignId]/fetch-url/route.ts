import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    // Fetch the URL content
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DirectionSetting/1.0; +https://birdie.studio)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${res.status}` },
        { status: 400 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    let content: string;

    if (contentType.includes("text/html")) {
      const html = await res.text();
      // Strip HTML tags, scripts, styles — extract text content
      content = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/ {2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      content = await res.text();
    }

    // Truncate
    const truncated =
      content.length > 20000
        ? content.slice(0, 20000) + "\n\n[...truncated]"
        : content;

    // Also save as a knowledge entry for future reference
    await prisma.knowledgeEntry.create({
      data: {
        campaignId,
        area: "other",
        title: `Web: ${new URL(url).hostname}${new URL(url).pathname.slice(0, 40)}`,
        content: truncated.slice(0, 5000),
      },
    });

    return NextResponse.json({ content: truncated, url });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch URL",
      },
      { status: 500 }
    );
  }
}
