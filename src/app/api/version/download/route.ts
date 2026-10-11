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

  return NextResponse.redirect(downloadUrl, 302);
}
