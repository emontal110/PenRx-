import { NextRequest, NextResponse } from "next/server";
import versionConfig from "@/config/version.json";

export const dynamic = "force-dynamic";

// Only official GitHub release artifacts may be served through this redirect
function isAllowedDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "github.com" && parsed.hostname !== "objects.githubusercontent.com") {
      return false;
    }
    if (parsed.hostname === "github.com") {
      return /^\/emontal110\/PenRx-\/(releases|archive)\//.test(parsed.pathname);
    }
    return true; // GitHub release CDN host
  } catch {
    return false;
  }
}

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
  } else if (!isAllowedDownloadUrl(downloadUrl)) {
    return NextResponse.json(
      { error: "رابط التنزيل مرفوض: يُسمح فقط بروابط الإصدارات الرسمية على GitHub" },
      { status: 400 }
    );
  }

  return NextResponse.redirect(downloadUrl, 302);
}
