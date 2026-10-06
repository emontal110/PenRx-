import { NextRequest, NextResponse } from "next/server";
import versionConfig from "@/config/version.json";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "desktop";
  const customUrl = searchParams.get("url");

  const repo = versionConfig.githubRepo || "emontal110/PenRx-";
  let downloadUrl = customUrl;

  if (!downloadUrl) {
    if (type === "mobile" || type === "android") {
      downloadUrl =
        versionConfig.androidDownloadUrl ||
        `https://github.com/${repo}/releases/latest/download/PenRX+.apk`;
    } else {
      downloadUrl =
        versionConfig.desktopDownloadUrl ||
        `https://github.com/${repo}/releases/latest/download/PenRX+-Setup.exe`;
    }
  }

  try {
    const upstreamRes = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "PenRX-App-Downloader",
      },
      redirect: "follow",
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      // Fallback: Redirect directly to the original URL if streaming isn't available
      return NextResponse.redirect(downloadUrl);
    }

    const contentType =
      upstreamRes.headers.get("content-type") ||
      (type === "mobile" ? "application/vnd.android.package-archive" : "application/octet-stream");
    const contentLength = upstreamRes.headers.get("content-length");
    const fileName = type === "mobile" ? "PenRX+.apk" : "PenRX+-Setup.exe";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (contentLength) headers.set("Content-Length", contentLength);
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return new NextResponse(upstreamRes.body as any, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("[Download Proxy Error]", err);
    // Safe fallback redirect
    return NextResponse.redirect(downloadUrl);
  }
}
