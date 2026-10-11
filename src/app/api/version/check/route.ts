import { NextResponse } from "next/server";
import versionConfig from "@/config/version.json";
import packageInfo from "../../../../../package.json";

export const dynamic = "force-dynamic";

function compareSemver(current: string, latest: string): boolean {
  try {
    const c = current.replace(/^v/, "").split(".").map(Number);
    const l = latest.replace(/^v/, "").split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const cPart = c[i] || 0;
      const lPart = l[i] || 0;
      if (lPart > cPart) return true;
      if (lPart < cPart) return false;
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientVersion = searchParams.get("currentVersion");

  const currentVersion = clientVersion
    ? clientVersion.replace(/^v/, "").trim()
    : versionConfig.version || (packageInfo.version ? packageInfo.version.replace(/\.0$/, "") : "1.5");
  const repo = versionConfig.githubRepo || "emontal110/PenRx-";

  try {
    // 1. Prioritize check: GitHub Releases API for published release with real assets
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "PenRX-App",
      },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const releaseData = await res.json();
      const latestTag = releaseData.tag_name || releaseData.name || currentVersion;
      const latestVersion = latestTag.replace(/^v/, "").trim();
      const hasUpdate = compareSemver(currentVersion, latestVersion);

      let desktopUrl = `https://github.com/${repo}/releases/latest/download/PenRX+-Setup.exe`;
      let androidUrl = `https://github.com/${repo}/releases/latest/download/PenRX+.apk`;

      if (Array.isArray(releaseData.assets)) {
        const exeAsset = releaseData.assets.find((a: any) => a.name?.endsWith(".exe"));
        if (exeAsset?.browser_download_url) desktopUrl = exeAsset.browser_download_url;

        const apkAsset = releaseData.assets.find((a: any) => a.name?.endsWith(".apk"));
        if (apkAsset?.browser_download_url) androidUrl = apkAsset.browser_download_url;
      }

      return NextResponse.json({
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseDate: releaseData.published_at?.split("T")[0] || versionConfig.releaseDate,
        releaseNotes: releaseData.body || versionConfig.releaseNotes,
        desktopDownloadUrl: desktopUrl,
        androidDownloadUrl: androidUrl,
      });
    }

    // 2. Fallback check: raw version.json from GitHub
    const rawUrl = `https://raw.githubusercontent.com/${repo}/main/src/config/version.json?t=${Date.now()}`;
    const rawRes = await fetch(rawUrl, {
      headers: { "User-Agent": "PenRX-App" },
      cache: "no-store",
    });

    if (rawRes.ok) {
      const rawData = await rawRes.json();
      const latestVersion = (rawData.version || currentVersion).replace(/^v/, "").trim();
      const hasUpdate = compareSemver(currentVersion, latestVersion);

      if (hasUpdate) {
        return NextResponse.json({
          hasUpdate: true,
          currentVersion,
          latestVersion,
          releaseDate: rawData.releaseDate || new Date().toISOString().split("T")[0],
          releaseNotes: rawData.releaseNotes || `تحديث جديد متاح v${latestVersion}`,
          desktopDownloadUrl: rawData.desktopDownloadUrl || `https://github.com/${repo}/releases/download/v${latestVersion}/PenRX+-Setup.exe`,
          androidDownloadUrl: rawData.androidDownloadUrl || `https://github.com/${repo}/releases/download/v${latestVersion}/PenRX+.apk`,
        });
      }
    }

    // Default if no update
    return NextResponse.json({
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseNotes: versionConfig.releaseNotes,
      desktopDownloadUrl: versionConfig.desktopDownloadUrl,
      androidDownloadUrl: versionConfig.androidDownloadUrl,
    });
  } catch (err: any) {
    return NextResponse.json({
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseNotes: versionConfig.releaseNotes,
      desktopDownloadUrl: versionConfig.desktopDownloadUrl,
      androidDownloadUrl: versionConfig.androidDownloadUrl,
    });
  }
}
