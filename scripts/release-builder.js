const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releasesDir = path.join(rootDir, "releases");

// 1. Read arguments
const targetVersion = process.argv[2] || "patch";
const releaseNotes = process.argv[3] || `تحديث جديد لمنظومة PenRX+ الطبية`;

console.log("\n============================================================");
console.log("🌟 منظومة PenRX+ الإدارية - معالج الإصدارات والتحديث التلقائي");
console.log("============================================================\n");

function run(command, cwd = rootDir) {
  console.log(`\n⏳ جارٍ تنفيذ: ${command}`);
  try {
    execSync(command, { cwd, stdio: "inherit" });
    return true;
  } catch (err) {
    console.error(`⚠️ فشل أو تحذير أثناء تنفيذ: ${command}`);
    return false;
  }
}

// Ensure releases folder exists
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
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

// Step 2: Build Next.js
console.log("\n📌 الخطوة 2: بناء واجهات ونواة النظام (Next.js & Prisma)...");
run("npm run build");

// Step 3: Capacitor Android Sync
console.log("\n📌 الخطوة 3: مزامنة تطبيق الهاتف (Capacitor Android)...");
run("npx cap sync android");

// Step 4: Build Android APK if Gradle is present
console.log("\n📌 الخطوة 4: فحص وتوليد تطبيق الهاتف (Android APK)...");
const androidDir = path.join(rootDir, "android");
let apkFound = false;

if (fs.existsSync(androidDir)) {
  // Check if gradlew.bat can run
  const gradlewBat = path.join(androidDir, "gradlew.bat");
  if (fs.existsSync(gradlewBat)) {
    console.log("جارٍ محاولة بناء الـ APK عبر Gradle...");
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
      console.log(`✅ تم نسخ ملف الـ APK بنجاح إلى: releases/PenRX+.apk`);
      apkFound = true;
    }
  }
}

if (!apkFound) {
  // Create an informative readme or copy fallback APK if existing
  const apkInfoFile = path.join(releasesDir, "PenRX+-APK-Build-Info.txt");
  fs.writeFileSync(
    apkInfoFile,
    `تطبيق PenRX+ للأندرويد - الإصدار v${activeVersion}\n` +
      `يمكنك فتح مشروع الأندرويد في Android Studio عبر الأمر: npx cap open android\n` +
      `أو تثبيت Java JDK ثم تشغيل gradlew.bat assembleRelease لإنشاء الـ APK النهائي.\n`,
    "utf8"
  );
  console.log(`ℹ️ مشروع الأندرويد جاهز ومحدث في مجلد android/ (Capacitor v6)`);
}

// Step 5: Build Desktop App with electron-builder
console.log("\n📌 الخطوة 5: بناء وتغليف برنامج سطح المكتب (Windows Desktop)...");
run("npx electron-builder --win --dir");

// Search for generated executable
const distElectron = path.join(rootDir, "dist-electron");
if (fs.existsSync(distElectron)) {
  const winUnpacked = path.join(distElectron, "win-unpacked");
  if (fs.existsSync(winUnpacked)) {
    const mainExe = path.join(winUnpacked, "PenRX+.exe");
    if (fs.existsSync(mainExe)) {
      fs.copyFileSync(mainExe, path.join(releasesDir, "PenRX+.exe"));
      fs.copyFileSync(mainExe, path.join(versionDir, `PenRX+-v${activeVersion}.exe`));
      console.log(`✅ تم توليد وتحديث برنامج الكمبيوتر: releases/PenRX+.exe`);
    }
  }

  // Also check for NSIS installer if generated
  const files = fs.readdirSync(distElectron);
  const exeInstaller = files.find((f) => f.endsWith(".exe") && !f.includes("win-unpacked"));
  if (exeInstaller) {
    fs.copyFileSync(path.join(distElectron, exeInstaller), path.join(releasesDir, "PenRX+-Setup.exe"));
    fs.copyFileSync(
      path.join(distElectron, exeInstaller),
      path.join(versionDir, `PenRX+-Setup-v${activeVersion}.exe`)
    );
    console.log(`✅ تم نسخ مثبت الويندوز: releases/PenRX+-Setup.exe`);
  }
}

// Step 6: Git commit, tag, and push
console.log("\n📌 الخطوة 6: رفع ومزامنة المشروع مع GitHub المستودع الرسمي...");
run("git add .");

// Check if there are changes to commit
try {
  run(`git commit -m "Release v${activeVersion}: ${releaseNotes}"`);
} catch (e) {
  console.log("لا توجد تغييرات جديدة للالتزام بها.");
}

// Create git tag
try {
  run(`git tag -a v${activeVersion} -m "Release v${activeVersion}"`);
} catch (e) {
  console.log(`Tag v${activeVersion} موجود مسبقاً أو تم إنشاؤه.`);
}

// Push to GitHub main branch and tags
console.log("\nجارٍ الدفع إلى GitHub: https://github.com/emontal110/PenRx-.git ...");
run("git push origin main --tags");

console.log("\n============================================================");
console.log(`🎉 تم إطلاق وتحديث الإصدار v${activeVersion} بنجاح!`);
console.log("============================================================");
console.log(`📁 مجلد المخرجات: ${releasesDir}`);
console.log(`🌐 مستودع GitHub: https://github.com/emontal110/PenRx-`);
console.log(`🔔 نظام التحديث التلقائي: سيشعر الآن أي جهاز أو تطبيق بوجود الإصدار v${activeVersion} فوراً.`);
console.log("============================================================\n");
