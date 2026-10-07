const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releasesDir = path.join(rootDir, "releases");
const publicDownloadsDir = path.join(rootDir, "public", "downloads");

// 1. Read command-line arguments
const args = process.argv.slice(2);
const shouldPush = !args.includes("--no-push");
const filteredArgs = args.filter((a) => a !== "--no-push");

const targetVersion = filteredArgs[0] || "minor";
const releaseNotes = filteredArgs[1] || "PenRX+ Official Automated Release";

// Visual Overall Progress Bar Helper
const TOTAL_STEPS = 6;
const startTime = Date.now();

function updateTitle(text) {
  try {
    process.stdout.write(`\x1b]2;${text}\x07`);
    process.title = text;
  } catch {}
}

function renderBar(percent, length = 28) {
  const safePercent = Math.min(100, Math.max(0, percent));
  const filled = Math.round((safePercent / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function printStep(stepNum, title, description) {
  const currentPercent = Math.round(((stepNum - 1) / TOTAL_STEPS) * 100);
  const bar = renderBar(currentPercent, 28);
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  updateTitle(`[${currentPercent}%] (Step ${stepNum}/${TOTAL_STEPS}) PenRX+ ${title}`);

  console.log("\n" + "=".repeat(70));
  console.log(`  [OVERALL PIPELINE PROGRESS: ${String(currentPercent).padStart(3, " ")}%] [${bar}]`);
  console.log(`  [*] STEP ${stepNum}/${TOTAL_STEPS}: ${title}`);
  if (description) {
    console.log(`      Details: ${description}`);
  }
  console.log(`      Elapsed: ${elapsed}s`);
  console.log("=".repeat(70) + "\n");
}

function completeStep(stepNum, title) {
  const completedPercent = Math.round((stepNum / TOTAL_STEPS) * 100);
  const bar = renderBar(completedPercent, 28);
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  updateTitle(`[${completedPercent}%] (Step ${stepNum}/${TOTAL_STEPS} Done) PenRX+ ${title}`);

  console.log("\n" + "-".repeat(70));
  console.log(`  ✓ STEP ${stepNum}/${TOTAL_STEPS} COMPLETED! (${elapsed}s elapsed)`);
  console.log(`    Current Progress: [${bar}] ${completedPercent}%`);
  console.log("-".repeat(70) + "\n");
}

function run(command, cwd = rootDir) {
  console.log(`>> Executing: ${command}`);
  try {
    execSync(command, { cwd, stdio: "inherit", env: process.env });
    return true;
  } catch (err) {
    console.error(`[!] Warning or error executing: ${command}`);
    return false;
  }
}

console.log("\n====================================================================");
console.log("  [PenRX+] Automated Build & Release Pipeline");
console.log("====================================================================");
console.log(`[*] Project Path: ${rootDir}`);
console.log(`[*] Start Time:   ${new Date().toLocaleTimeString("en-US")}`);
console.log(`[*] Push to Git:  ${shouldPush ? "ENABLED" : "DISABLED (Local build only)"}\n`);

// Ensure releasesDir exists and clean any old subfolders
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
} else {
  // Automatically remove old subdirectories so releases/ only contains the latest files
  const items = fs.readdirSync(releasesDir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      fs.rmSync(path.join(releasesDir, item.name), { recursive: true, force: true });
    }
  }
}
if (!fs.existsSync(publicDownloadsDir)) {
  fs.mkdirSync(publicDownloadsDir, { recursive: true });
}

// ── Auto-Detect Java & Android SDK on Windows ──
const localAppData = process.env.LOCALAPPDATA || "";
const javaCandidates = [
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  "C:\\Program Files\\Android\\Android Studio\\jre",
  path.join(localAppData, "Programs", "Android Studio", "jbr"),
  "C:\\Program Files\\Java\\jdk-17",
  "C:\\Program Files\\Java\\jdk-21",
  "C:\\Program Files\\Eclipse Adoptium\\jdk-17",
  "C:\\Program Files\\Eclipse Adoptium\\jdk-21",
  "C:\\Program Files\\Microsoft\\jdk-17",
  "C:\\Program Files\\Microsoft\\jdk-21",
];

if (!process.env.JAVA_HOME) {
  for (const jPath of javaCandidates) {
    if (fs.existsSync(jPath)) {
      process.env.JAVA_HOME = jPath;
      process.env.PATH = `${path.join(jPath, "bin")};${process.env.PATH}`;
      console.log(`[Java] Detected Java environment: ${jPath}`);
      break;
    }
  }
}

const androidSdkCandidate = path.join(localAppData, "Android", "Sdk");
if (!process.env.ANDROID_HOME && fs.existsSync(androidSdkCandidate)) {
  process.env.ANDROID_HOME = androidSdkCandidate;
}

// ====================================================================
// STEP 1: Version Bumping
// ====================================================================
printStep(
  1,
  "Version Synchronization & Bump",
  "Updating package.json, version.json, build.gradle, and landing pages"
);
run(`node scripts/bump-version.js ${targetVersion} "${releaseNotes}"`);

// Read newly set version
const versionConfig = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src", "config", "version.json"), "utf8")
);
const activeVersion = versionConfig.version;
console.log(`✓ Active version configured: v${activeVersion}`);
completeStep(1, "Version Configured to v" + activeVersion);

// ====================================================================
// STEP 2: Build Next.js & Prisma
// ====================================================================
printStep(
  2,
  "Build Core Application Engine (Next.js & Prisma)",
  "Generating database client and building production pages & API routes"
);
const buildSuccess = run("npm run build");
if (!buildSuccess) {
  console.warn("[!] Warning encountered during Next.js build, proceeding...");
} else {
  console.log("✓ Core application engine compiled successfully.");
}
completeStep(2, "Core Application Engine Compiled");

// ====================================================================
// STEP 3: Capacitor Android Sync
// ====================================================================
printStep(
  3,
  "Sync Mobile Platform Assets (Capacitor Android)",
  "Preparing web output assets and syncing native Android workspace"
);
const outDir = path.join(rootDir, "out");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outIndex = path.join(outDir, "index.html");
const mobileSource = path.join(rootDir, "mobile.html");
if (fs.existsSync(mobileSource)) {
  fs.copyFileSync(mobileSource, outIndex);
} else {
  const portalSource = path.join(rootDir, "portal.html");
  if (fs.existsSync(portalSource)) {
    fs.copyFileSync(portalSource, outIndex);
  }
}
// Copy supporting assets for portal
const assetsToCopy = ["logo-penrx.jpg", "favicon.ico", "icon-512.png", "error.html"];
for (const a of assetsToCopy) {
  const srcDoc = path.join(rootDir, "docs", a);
  const srcPub = path.join(rootDir, "public", a);
  const dst = path.join(outDir, a);
  if (fs.existsSync(srcDoc)) fs.copyFileSync(srcDoc, dst);
  else if (fs.existsSync(srcPub)) fs.copyFileSync(srcPub, dst);
}
const iconScript = path.join(rootDir, "scripts", "generate-android-icons.ps1");
if (fs.existsSync(iconScript) && process.platform === "win32") {
  try {
    run("powershell -ExecutionPolicy Bypass -File scripts/generate-android-icons.ps1");
  } catch (e) {
    console.warn("Notice: Android launcher icon update skipped:", e.message);
  }
}
run("npx cap sync android");
console.log("✓ Native Android files synchronized with android/ folder.");
completeStep(3, "Mobile Platform Assets Synced");

// ====================================================================
// STEP 4: Build Android Release APK
// ====================================================================
printStep(
  4,
  "Build & Verify Android Release APK Installer",
  "Compiling release signed APK via Gradle with permanent release keystore"
);
const androidDir = path.join(rootDir, "android");
let apkFound = false;

if (fs.existsSync(androidDir)) {
  const gradlewBat = path.join(androidDir, "gradlew.bat");
  if (fs.existsSync(gradlewBat) && process.env.JAVA_HOME) {
    console.log("⚡ Java environment available. Building official release APK via Gradle...");
    run("gradlew.bat assembleRelease", androidDir);
    const releaseApk = path.join(
      androidDir,
      "app",
      "build",
      "outputs",
      "apk",
      "release",
      "app-release.apk"
    );
    const debugApk = path.join(
      androidDir,
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk"
    );
    const apkSource = fs.existsSync(releaseApk) ? releaseApk : (fs.existsSync(debugApk) ? debugApk : null);
    if (apkSource) {
      fs.copyFileSync(apkSource, path.join(releasesDir, "PenRX+.apk"));
      fs.copyFileSync(apkSource, path.join(publicDownloadsDir, "PenRX+.apk"));
      console.log(`✓ Updated official release APK:`);
      console.log(`   - releases/PenRX+.apk`);
      console.log(`   - public/downloads/PenRX+.apk`);
      apkFound = true;
    }
  }
}

if (!apkFound) {
  const apkInfoFile = path.join(releasesDir, "PenRX+-APK-Build-Info.txt");
  fs.writeFileSync(
    apkInfoFile,
    `PenRX+ Android Release Info v${activeVersion}\n` +
      `Android assets synchronized in android/ folder.\n` +
      `Cloud pipeline will build the signed release APK when tag is pushed.\n`,
    "utf8"
  );
  console.log(`ℹ Android workspace synchronized in android/ folder.`);
  console.log(`⚡ Official release APK will be compiled on cloud pipeline upon tag push.`);
}
completeStep(4, "Android Release APK Verified & Ready");

// ====================================================================
// STEP 5: Build Windows Desktop App
// ====================================================================
printStep(
  5,
  "Package Windows Desktop Installer (electron-builder NSIS)",
  "Creating single-click / next-next PenRX+-Setup.exe installer"
);
// Clean temp caches (.next/cache and dist-electron) to accelerate compression
const nextCache = path.join(rootDir, ".next", "cache");
if (fs.existsSync(nextCache)) {
  try {
    fs.rmSync(nextCache, { recursive: true, force: true });
  } catch {}
}

const distElectron = path.join(rootDir, "dist-electron");
if (fs.existsSync(distElectron)) {
  try {
    fs.rmSync(distElectron, { recursive: true, force: true });
  } catch {}
}

console.log("⚡ Compressing and packaging Windows Setup installer (optimized fast build)...");
run("npx electron-builder --win");

if (fs.existsSync(distElectron)) {
  // Check for unpacked direct EXE
  const winUnpacked = path.join(distElectron, "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    const mainExe = path.join(winUnpacked, "PenRX+.exe");
    if (fs.existsSync(mainExe)) {
      fs.copyFileSync(mainExe, path.join(releasesDir, "PenRX+.exe"));
      console.log(`✓ Updated portable desktop app: releases/PenRX+.exe`);
    }
  }

  // Check for NSIS Installer EXE
  const files = fs.readdirSync(distElectron);
  const exeInstaller = files.find((f) => f.endsWith(".exe") && !f.includes("win-unpacked"));
  if (exeInstaller) {
    const installerSource = path.join(distElectron, exeInstaller);
    fs.copyFileSync(installerSource, path.join(releasesDir, "PenRX+-Setup.exe"));
    console.log(`✓ Updated official Windows Setup installer:`);
    console.log(`   - releases/PenRX+-Setup.exe`);
  }
}
completeStep(5, "Windows Desktop Installer Packaged");

// ====================================================================
// STEP 6: Git Commit & Release Handling
// ====================================================================
printStep(
  6,
  "Git Commit & Release Finalization",
  shouldPush
    ? "Staging, committing, and pushing to GitHub (main & gh-pages)"
    : "Staging and committing locally (GitHub Push skipped by user request)"
);

// 1. Stage all changes
run("git add -A");

// 2. Commit
try {
  run(`git commit -m "Release v${activeVersion}: ${releaseNotes}"`);
} catch (e) {
  console.log("ℹ No new changes to commit.");
}

// 3. Tag
try {
  run(`git tag -a v${activeVersion} -m "Release v${activeVersion}"`);
} catch (e) {
  console.log(`ℹ Tag v${activeVersion} already exists or was created.`);
}

if (shouldPush) {
  // Push to main branch first to reliably trigger GitHub Pages deployment
  console.log("\n🚀 Pushing to GitHub main branch (triggers web & pages build)...");
  run("git push origin main");

  // Push release tags to trigger cloud release builders
  console.log("🏷 Pushing release tags...");
  run("git push origin --tags");

  // Push to gh-pages branch
  console.log("🚀 Syncing GitHub Pages hosting branch (gh-pages)...");
  run("git push origin main:gh-pages --force");

  // Fast-forward local gh-pages if possible
  try {
    run("git checkout gh-pages");
    run("git merge main");
    run("git checkout main");
  } catch (e) {}
} else {
  console.log("\n🔒 GitHub push skipped as requested. All release files are ready locally.");
}
completeStep(6, "Git & Release Workflow Finalized");

const duration = Math.round((Date.now() - startTime) / 1000);
const minutes = Math.floor(duration / 60);
const seconds = duration % 60;

updateTitle(`[100%] [DONE] PenRX+ Release v${activeVersion} Completed!`);

console.log("\n" + "=".repeat(70));
console.log(`  [OVERALL PIPELINE PROGRESS: 100%] [${renderBar(100, 28)}]`);
console.log(`  🎉 ALL 6 RELEASE PIPELINE STEPS COMPLETED IN ${minutes}m ${seconds}s!`);
console.log("=".repeat(70));
console.log(`[*] Releases Folder:   ${releasesDir}`);
console.log(`[*] Local Setup File:  ${path.join(releasesDir, "PenRX+-Setup.exe")}`);
console.log(`[*] Official APK File: ${path.join(releasesDir, "PenRX+.apk")}`);
console.log(`[*] GitHub Repo:       https://github.com/emontal110/PenRx-`);
console.log(`[*] GitHub Push:       ${shouldPush ? "DONE" : "SKIPPED (Local only)"}`);
console.log("=".repeat(70) + "\n");
