import { NextResponse } from "next/server";
import versionConfig from "@/config/version.json";
import packageInfo from "../../../../../package.json";
import { proxyToCloud } from "@/lib/cloudProxy";

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

function getGithubAuthToken(): string {
  return (
    process.env.GITHUB_RELEASE_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.RELEASE_TOKEN ||
    process.env.GITHUB_TOKEN ||
    ""
  ).trim();
}

function buildGithubHeaders(accept = "application/vnd.github.v3+json"): Record<string, string> {
  const token = getGithubAuthToken();
  return {
    Accept: accept,
    "User-Agent": "PenRX-App-Updater",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientVersion = searchParams.get("currentVersion");
  const downloadType = searchParams.get("download"); // "exe" | "apk" | "blockmap" | "yml"

  const currentVersion = clientVersion
    ? clientVersion.replace(/^v/, "").trim()
    : versionConfig.version || (packageInfo.version ? packageInfo.version.replace(/\.0$/, "") : "1.68");
  const repo = versionConfig.githubRepo || "emontal110/PenRx-";
  const token = getGithubAuthToken();
  const hasToken = Boolean(token);

  // Packaged desktop runtime forwards to authoritative Vercel deployment,
  // or falls back to direct public GitHub releases if cloud proxy is unreachable.
  if (!hasToken && !process.env.VERCEL && !process.env.NEXT_PUBLIC_VERCEL_ENV) {
    try {
      const cloudRes = await proxyToCloud(req, "/api/version/check");
      if (cloudRes.ok) return cloudRes;
    } catch (proxyErr) {
      console.warn("[VersionCheck] Cloud proxy notice, falling back to direct public GitHub:", proxyErr);
    }
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: buildGithubHeaders(),
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const releaseData = await res.json();
      const assets: any[] = Array.isArray(releaseData.assets) ? releaseData.assets : [];

      // Private-repo compatible asset download redirector:
      // Resolves the GitHub API asset endpoint using the server's GITHUB_RELEASE_TOKEN
      // and redirects the client directly to the temporary signed S3 asset URL.
      if (downloadType) {
        const targetAsset = assets.find((a: any) => {
          const name = String(a?.name || "").toLowerCase();
          if (downloadType === "exe") return name.endsWith(".exe");
          if (downloadType === "apk") return name.endsWith(".apk");
          if (downloadType === "blockmap") return name.endsWith(".blockmap");
          if (downloadType === "yml") return name === "latest.yml";
          return false;
        });

        if (targetAsset) {
          if (hasToken && targetAsset.url) {
            const assetRes = await fetch(targetAsset.url, {
              headers: buildGithubHeaders("application/octet-stream"),
              redirect: "manual",
            });
            const signedLocation = assetRes.headers.get("location");
            if (signedLocation) {
              return NextResponse.redirect(signedLocation, 302);
            }
          }
          if (targetAsset.browser_download_url) {
            return NextResponse.redirect(targetAsset.browser_download_url, 302);
          }
        }
      }

      const latestTag = releaseData.tag_name || releaseData.name || currentVersion;
      const latestVersion = latestTag.replace(/^v/, "").trim();
      const hasUpdate = compareSemver(currentVersion, latestVersion);

      const appBase = (process.env.NEXT_PUBLIC_APP_URL || "https://pen-rx.vercel.app").replace(/\/+$/, "");
      let desktopUrl = hasToken
        ? `${appBase}/api/version/check?download=exe`
        : `https://github.com/${repo}/releases/latest/download/PenRX+-Setup.exe`;
      let androidUrl = hasToken
        ? `${appBase}/api/version/check?download=apk`
        : `https://github.com/${repo}/releases/latest/download/PenRX+.apk`;
      let hasReadyInstallerAsset = false;

      const exeAsset = assets.find((a: any) => a.name?.endsWith(".exe"));
      if (exeAsset) {
        if (!hasToken && exeAsset.browser_download_url) {
          desktopUrl = exeAsset.browser_download_url;
        }
        hasReadyInstallerAsset = true;
      }

      const apkAsset = assets.find((a: any) => a.name?.endsWith(".apk"));
      if (apkAsset) {
        if (!hasToken && apkAsset.browser_download_url) {
          androidUrl = apkAsset.browser_download_url;
        }
        hasReadyInstallerAsset = true;
      }

      return NextResponse.json({
        hasUpdate: hasUpdate && hasReadyInstallerAsset && !releaseData.draft,
        currentVersion,
        latestVersion,
        releaseDate: releaseData.published_at?.split("T")[0] || versionConfig.releaseDate,
        releaseNotes: releaseData.body || versionConfig.releaseNotes,
        desktopDownloadUrl: desktopUrl,
        androidDownloadUrl: androidUrl,
        privateRepoAuth: hasToken,
      });
    }

    return NextResponse.json({
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseNotes: versionConfig.releaseNotes,
      desktopDownloadUrl: versionConfig.desktopDownloadUrl,
      androidDownloadUrl: versionConfig.androidDownloadUrl,
    });
  } catch {
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
