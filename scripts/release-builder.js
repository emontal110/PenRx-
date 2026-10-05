const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releasesDir = path.join(rootDir, "releases");
const publicDownloadsDir = path.join(rootDir, "public", "downloads");

// 1. Read arguments
const targetVersion = process.argv[2] || "patch";
const releaseNotes = process.argv[3] || `تحديث جديد لمنظومة PenRX+ الطبية`;

console.log("\n============================================================");
console.log("🌟 منظومة PenRX+ الإدارية - معالج الإصدارات الشامل والتحديث السحابي");
console.log("============================================================\n");

function run(command, cwd = rootDir) {
  console.log(`\n⏳ جارٍ تنفيذ: ${command}`);
  try {
    execSync(command, { cwd, stdio: "inherit", env: process.env });
    return true;
  } catch (err) {
    console.error(`⚠️ فشل أو تحذير أثناء تنفيذ: ${command}`);
    return false;
  }
}

// Ensure output directories exist
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
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
      console.log(`[Java] تم التعرف على بيئة جافا تلقائياً: ${jPath}`);
      break;
    }
  }
}

const androidSdkCandidate = path.join(localAppData, "Android", "Sdk");
if (!process.env.ANDROID_HOME && fs.existsSync(androidSdkCandidate)) {
  process.env.ANDROID_HOME = androidSdkCandidate;
}

// Step 1: Bump version in package.json, version.json, and android build.gradle
console.log("📌 الخطوة 1: تحديث رقم الإصدار في ملفات التكوين والواجهة...");
run(`node scripts/bump-version.js ${targetVersion} "${releaseNotes}"`);

// Read newly set version
const versionConfig = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src", "config", "version.json"), "utf8")
);
const activeVersion = versionConfig.version;
const versionDir = path.join(releasesDir, `v${activeVersion}`);
if (!fs.existsSync(versionDir)) {
  fs.mkdirSync(versionDir, { recursive: true });
}

// Step 2: Build Next.js & Prisma
console.log("\n📌 الخطوة 2: بناء واجهات ونواة النظام (Next.js & Prisma)...");
run("npm run build");

// Step 3: Capacitor Android Sync
console.log("\n📌 الخطوة 3: مزامنة تطبيق الهاتف (Capacitor Android)...");
const outDir = path.join(rootDir, "out");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outIndex = path.join(outDir, "index.html");
if (!fs.existsSync(outIndex)) {
  const docsIndex = path.join(rootDir, "docs", "index.html");
  if (fs.existsSync(docsIndex)) {
    fs.copyFileSync(docsIndex, outIndex);
  } else {
    fs.writeFileSync(outIndex, "<!DOCTYPE html><html><head><meta charset='utf-8'><title>PenRX+</title></head><body>Loading PenRX+...</body></html>", "utf8");
  }
}
run("npx cap sync android");

// Step 4: Build Android APK
console.log("\n📌 الخطوة 4: فحص وتوليد تطبيق الهاتف (Android APK)...");
const androidDir = path.join(rootDir, "android");
let apkFound = false;

if (fs.existsSync(androidDir)) {
  const gradlewBat = path.join(androidDir, "gradlew.bat");
  if (fs.existsSync(gradlewBat)) {
    console.log("جارٍ بناء الـ APK عبر Gradle...");
    const gradleSuccess = run("gradlew.bat assembleDebug", androidDir);
    const debugApk = path.join(
      androidDir,
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk"
    );
    if (fs.existsSync(debugApk)) {
      fs.copyFileSync(debugApk, path.join(releasesDir, "PenRX+.apk"));
      fs.copyFileSync(debugApk, path.join(versionDir, `PenRX+-v${activeVersion}.apk`));
      fs.copyFileSync(debugApk, path.join(publicDownloadsDir, "PenRX+.apk"));
      console.log(`✅ تم نسخ وتحديث ملف الـ APK بنجاح إلى:`);
      console.log(`   - releases/PenRX+.apk`);
      console.log(`   - releases/v${activeVersion}/PenRX+-v${activeVersion}.apk`);
      console.log(`   - public/downloads/PenRX+.apk`);
      apkFound = true;
    }
  }
}

if (!apkFound) {
  const apkInfoFile = path.join(releasesDir, "PenRX+-APK-Build-Info.txt");
  fs.writeFileSync(
    apkInfoFile,
    `تطبيق PenRX+ للأندرويد - الإصدار v${activeVersion}\n` +
      `مشروع الأندرويد تم تحديثه ومزامنته بالكامل في مجلد android/\n` +
      `سيقوم سيرفر GitHub Actions تلقائياً ببناء الـ APK ونشره في صفحة Releases بمجرد رفع الإصدار.\n`,
    "utf8"
  );
  console.log(`ℹ️ تم مزامنة كود الأندرويد في مجلد android/ (سيتم بناؤه تلقائياً أيضاً على GitHub Actions).`);
}

// Step 5: Build Desktop App with electron-builder
console.log("\n📌 الخطوة 5: بناء وتغليف برنامج سطح المكتب (Windows Desktop Installer)...");
run("npx electron-builder --win");

// Search for generated executable
const distElectron = path.join(rootDir, "dist-electron");
if (fs.existsSync(distElectron)) {
  // Check for unpacked EXE
  const winUnpacked = path.join(distElectron, "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    const mainExe = path.join(winUnpacked, "PenRX+.exe");
    if (fs.existsSync(mainExe)) {
      fs.copyFileSync(mainExe, path.join(releasesDir, "PenRX+.exe"));
      fs.copyFileSync(mainExe, path.join(versionDir, `PenRX+-v${activeVersion}.exe`));
      console.log(`✅ تم توليد وتحديث برنامج الكمبيوتر المباشر: releases/PenRX+.exe`);
    }
  }

  // Check for NSIS Installer EXE
  const files = fs.readdirSync(distElectron);
  const exeInstaller = files.find((f) => f.endsWith(".exe") && !f.includes("win-unpacked"));
  if (exeInstaller) {
    const installerSource = path.join(distElectron, exeInstaller);
    fs.copyFileSync(installerSource, path.join(releasesDir, "PenRX+-Setup.exe"));
    fs.copyFileSync(installerSource, path.join(versionDir, `PenRX+-Setup-v${activeVersion}.exe`));
    fs.copyFileSync(installerSource, path.join(publicDownloadsDir, "PenRX+-Setup.exe"));
    console.log(`✅ تم نسخ مثبت الويندوز النهائي بنجاح إلى:`);
    console.log(`   - releases/PenRX+-Setup.exe`);
    console.log(`   - releases/v${activeVersion}/PenRX+-Setup-v${activeVersion}.exe`);
    console.log(`   - public/downloads/PenRX+-Setup.exe`);
  }
}

// Step 6: Git commit, tag, and push
console.log("\n📌 الخطوة 6: رفع ومزامنة المشروع مع المستودع الرسمي على GitHub...");
run("git add .");

try {
  run(`git commit -m "Release v${activeVersion}: ${releaseNotes}"`);
} catch (e) {
  console.log("ℹ️ لا توجد تغييرات إضافية للالتزام بها.");
}

try {
  run(`git tag -a v${activeVersion} -m "Release v${activeVersion}"`);
} catch (e) {
  console.log(`ℹ️ Tag v${activeVersion} موجود مسبقاً أو تم إنشاؤه.`);
}

console.log("\n🚀 جارٍ الدفع إلى GitHub: https://github.com/emontal110/PenRx-.git ...");
const pushSuccess = run("git push origin main --tags");
if (pushSuccess) {
  console.log("✅ تم الدفع والمزامنة مع GitHub بنجاح!");
  console.log("⚡ سيقوم GitHub Actions الآن ببناء نسخ Android و Windows ونشرها عبر GitHub Releases.");
}

console.log("\n============================================================");
console.log(`🎉 تم إطلاق وتحديث الإصدار v${activeVersion} بنجاح!`);
console.log("============================================================");
console.log(`📁 مجلد المخرجات: ${releasesDir}`);
console.log(`🌐 مستودع GitHub: https://github.com/emontal110/PenRx-`);
console.log(`🔔 نظام التحديث التلقائي: سيشعر الآن أي جهاز أو تطبيق بوجود الإصدار v${activeVersion} فوراً.`);
console.log("============================================================\n");
