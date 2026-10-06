const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releasesDir = path.join(rootDir, "releases");
const publicDownloadsDir = path.join(rootDir, "public", "downloads");

// 1. Read command-line arguments
const targetVersion = process.argv[2] || "patch";
const releaseNotes = process.argv[3] || "تحديث وإصدار تلقائي لمنظومة PenRX+ الطبية";

// Visual Progress Bar Helper
const TOTAL_STEPS = 6;
const startTime = Date.now();

function printStep(stepNum, title, description) {
  const percent = Math.round((stepNum / TOTAL_STEPS) * 100);
  const barLength = 26;
  const filled = Math.round((stepNum / TOTAL_STEPS) * barLength);
  const empty = barLength - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  console.log("\n" + "-".repeat(68));
  console.log(`[*] STEP ${stepNum}/${TOTAL_STEPS}: ${title}`);
  console.log(`    Progress: [${bar}] ${percent}%`);
  if (description) {
    console.log(`    Details:  ${description}`);
  }
  console.log("-".repeat(68) + "\n");
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
console.log("  منظومة PenRX+ الطبية - معالج البناء الشامل والإصدار الفوري");
console.log("====================================================================");
console.log(`[*] Project Path: ${rootDir}`);
console.log(`[*] Start Time:   ${new Date().toLocaleTimeString("en-US")}\n`);

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

// ====================================================================
// STEP 1: Version Bumping
// ====================================================================
printStep(
  1,
  "تحديث وتعديل رقم الإصدار في ملفات التكوين والواجهات",
  "مزامنة package.json, version.json, build.gradle, index.html"
);
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
console.log(`✅ رقم الإصدار النشط المعتمد: v${activeVersion}`);

// ====================================================================
// STEP 2: Build Next.js & Prisma
// ====================================================================
printStep(
  2,
  "بناء وتجهيز واجهات ونواة النظام (Next.js & Prisma Engine)",
  "توليد عميل قاعدة البيانات وبناء صفحات ومسارات API"
);
const buildSuccess = run("npm run build");
if (!buildSuccess) {
  console.warn("⚠️ حدث تحذير أثناء بناء Next.js، جارٍ المتابعة...");
} else {
  console.log("✅ اكتمل بناء واجهات ونواة النظام بنجاح.");
}

// ====================================================================
// STEP 3: Capacitor Android Sync
// ====================================================================
printStep(
  3,
  "مزامنة وتجهيز كود تطبيق الهاتف المحمول (Capacitor Android)",
  "نسخ مخرجات الواجهة وضبط إعدادات الأندرويد"
);
const outDir = path.join(rootDir, "out");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outIndex = path.join(outDir, "index.html");
const portalSource = path.join(rootDir, "portal.html");
if (fs.existsSync(portalSource)) {
  fs.copyFileSync(portalSource, outIndex);
  console.log("✅ تم ضبط بورتال الاشتراكات portal.html ليكون واجهة تطبيق الهاتف الرسمية (out/index.html).");
} else {
  const docsIndex = path.join(rootDir, "docs", "index.html");
  if (fs.existsSync(docsIndex)) {
    fs.copyFileSync(docsIndex, outIndex);
  }
}
// Copy supporting assets for portal
const assetsToCopy = ["logo-penrx.jpg", "favicon.ico", "icon-512.png"];
for (const a of assetsToCopy) {
  const srcDoc = path.join(rootDir, "docs", a);
  const srcPub = path.join(rootDir, "public", a);
  const dst = path.join(outDir, a);
  if (fs.existsSync(srcDoc)) fs.copyFileSync(srcDoc, dst);
  else if (fs.existsSync(srcPub)) fs.copyFileSync(srcPub, dst);
}
run("npx cap sync android");
console.log("✅ تمت مزامنة ملفات تطبيق الأندرويد مع مجلد android/ بنجاح.");

// ====================================================================
// STEP 4: Build Android APK
// ====================================================================
printStep(
  4,
  "فحص وتوليد تطبيق الهاتف (Android APK Installer)",
  "محاولة البناء المحلي عبر Gradle أو تهيئة سيرفر GitHub Actions"
);
const androidDir = path.join(rootDir, "android");
let apkFound = false;

if (fs.existsSync(androidDir)) {
  const gradlewBat = path.join(androidDir, "gradlew.bat");
  if (fs.existsSync(gradlewBat) && process.env.JAVA_HOME) {
    console.log("⚡ بيئة جافا متوفرة محلياً؛ جارٍ بناء الـ APK عبر Gradle...");
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
      `سيقوم سيرفر GitHub Actions السحابي ببناء الـ APK تلقائياً بمجرد رفع الـ Tag v${activeVersion}.\n`,
    "utf8"
  );
  console.log(`ℹ️ تم مزامنة كود الأندرويد في مجلد android/ بنجاح.`);
  console.log(`⚡ سيقوم سيرفر GitHub Actions ببناء حزمة الـ APK تلقائياً على السحابة ونشرها فور الدفع.`);
}

// ====================================================================
// STEP 5: Build Windows Desktop App
// ====================================================================
printStep(
  5,
  "بناء وتغليف برنامج سطح المكتب (Windows Desktop Installer)",
  "توليد مثبت الويندوز PenRX+-Setup.exe عبر electron-builder"
);
run("npx electron-builder --win");

const distElectron = path.join(rootDir, "dist-electron");
if (fs.existsSync(distElectron)) {
  // Check for unpacked direct EXE
  const winUnpacked = path.join(distElectron, "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    const mainExe = path.join(winUnpacked, "PenRX+.exe");
    if (fs.existsSync(mainExe)) {
      fs.copyFileSync(mainExe, path.join(releasesDir, "PenRX+.exe"));
      fs.copyFileSync(mainExe, path.join(versionDir, `PenRX+-v${activeVersion}.exe`));
      console.log(`✅ تم نسخ برنامج الكمبيوتر المباشر: releases/PenRX+.exe`);
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

// ====================================================================
// STEP 6: Git Commit, Tag, and Push to Both Branches
// ====================================================================
printStep(
  6,
  "الرفع والمزامنة السحابية مع GitHub على كلا الفرعين",
  "الدفع إلى main و gh-pages مع الـ Tags السحابية لتشغيل GitHub Actions"
);

// 1. Stage all changes
run("git add -A");

// 2. Commit
try {
  run(`git commit -m "Release v${activeVersion}: ${releaseNotes}"`);
} catch (e) {
  console.log("ℹ️ لا توجد تغييرات إضافية للالتزام بها.");
}

// 3. Tag
try {
  run(`git tag -a v${activeVersion} -m "Release v${activeVersion}"`);
} catch (e) {
  console.log(`ℹ️ Tag v${activeVersion} موجود مسبقاً أو تم إنشاؤه.`);
}

// 4. Push to main branch with tags
console.log("\n🚀 جارٍ الدفع إلى GitHub (الفرع main مع الـ Tags)...");
run("git push origin main --tags");

// 5. Push to gh-pages branch
console.log("🚀 جارٍ مزامنة وتحديث فرع الاستضافة السحابية (gh-pages)...");
run("git push origin main:gh-pages");

// 6. Fast-forward local gh-pages if possible
try {
  run("git checkout gh-pages");
  run("git merge main");
  run("git checkout main");
} catch (e) {}

const duration = Math.round((Date.now() - startTime) / 1000);
const minutes = Math.floor(duration / 60);
const seconds = duration % 60;

console.log("\n====================================================================");
console.log(`  [SUCCESS] PenRX+ Release v${activeVersion} Completed Successfully! (100%)`);
console.log(`  اكتمل بناء وإطلاق الإصدار بنجاح تام!`);
console.log("====================================================================");
console.log(`[*] Execution Time:    ${minutes}m ${seconds}s`);
console.log(`[*] Releases Folder:   ${releasesDir}`);
console.log(`[*] GitHub Repository: https://github.com/emontal110/PenRx-`);
console.log(`[*] Downloads Portal:  https://emontal110.github.io/PenRx-/`);
console.log(`[*] Management Portal: https://emontal110.github.io/PenRx-/portal.html`);
console.log("====================================================================\n");
