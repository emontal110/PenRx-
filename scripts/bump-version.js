const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const versionJsonPath = path.join(rootDir, "src", "config", "version.json");
const androidGradlePath = path.join(rootDir, "android", "app", "build.gradle");

// Read current package.json
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const currentVersion = pkg.version || "1.0.0";

// Determine new version
let newVersion = process.argv[2];
const releaseNotes = process.argv[3] || `تحديث تلقائي للإصدار الجديد v${newVersion || "1.0.1"}`;

if (!newVersion || newVersion === "patch") {
  const parts = currentVersion.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  newVersion = parts.join(".");
}

console.log(`\n======================================================`);
console.log(`🚀 Bumping PenRX+ Version: ${currentVersion} -> ${newVersion}`);
console.log(`======================================================\n`);

// 1. Update package.json
pkg.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`✓ Updated package.json version to: ${newVersion}`);

// 2. Update src/config/version.json
let versionConfig = {};
try {
  versionConfig = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
} catch {
  versionConfig = { versionCode: 1 };
}

const newVersionCode = (versionConfig.versionCode || 1) + 1;
versionConfig.version = newVersion;
versionConfig.versionCode = newVersionCode;
versionConfig.releaseDate = new Date().toISOString().split("T")[0];
versionConfig.releaseNotes = releaseNotes;
versionConfig.desktopDownloadUrl = `https://github.com/emontal110/PenRx-/releases/download/v${newVersion}/PenRX+-Setup.exe`;
versionConfig.androidDownloadUrl = `https://github.com/emontal110/PenRx-/releases/download/v${newVersion}/PenRX+.apk`;

fs.writeFileSync(versionJsonPath, JSON.stringify(versionConfig, null, 2) + "\n", "utf8");
console.log(`✓ Updated src/config/version.json (version: ${newVersion}, versionCode: ${newVersionCode})`);

// 3. Update android/app/build.gradle if it exists
if (fs.existsSync(androidGradlePath)) {
  let gradleContent = fs.readFileSync(androidGradlePath, "utf8");
  gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${newVersionCode}`);
  gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
  fs.writeFileSync(androidGradlePath, gradleContent, "utf8");
  console.log(`✓ Updated android/app/build.gradle (versionCode: ${newVersionCode}, versionName: "${newVersion}")`);
}

// 4. Update index.html and docs/index.html version labels
const indexFiles = [
  path.join(rootDir, "index.html"),
  path.join(rootDir, "docs", "index.html")
];
for (const file of indexFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    content = content.replace(/(class="[^"]*app-pkg-version[^"]*">)v[^<]+(<\/span>)/g, `$1v${newVersion}$2`);
    content = content.replace(/(الإصدار الرسمي\s+)v[0-9.]+(\s+متاح الآن)/g, `$1v${newVersion}$2`);
    fs.writeFileSync(file, content, "utf8");
    console.log(`✓ Updated version in ${path.relative(rootDir, file)} to v${newVersion}`);
  }
}

console.log(`\n✅ Version successfully bumped to v${newVersion}!\n`);
