# Prompts for the admin portal credentials and writes the derived hashes into .env.
# Nothing is echoed: Read-Host -AsSecureString hides input, and the script prints
# variable NAMES only.  Hashes match src/lib/adminAuth.ts exactly:
#   PASSWORD_HASH = PBKDF2(pw, salt, 10000, 64 bytes, SHA512) hex
#   PIN_HASH      = SHA256(pin.Trim()) hex
param(
  [string]$EnvFile = ".env"
)

function Unprotect([System.Security.SecureString]$sec) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringUni($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr) }
}

if (-not (Test-Path $EnvFile)) { Write-Error "not found: $EnvFile"; exit 1 }

$email = (Read-Host "Admin email").Trim()
$saltIn = (Read-Host "Salt (leave empty to generate 32 random hex)").Trim()
if (-not $saltIn) {
  $bytes = New-Object byte[] 16
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $salt = -join ($bytes | ForEach-Object { $_.ToString("x2") })
} else { $salt = $saltIn }

$pw = Unprotect (Read-Host "Portal password (12+ chars)" -AsSecureString)
$pin = Unprotect (Read-Host "Portal PIN (8+ chars)" -AsSecureString)

if ($pw.Length -lt 12) { Write-Error "password too short (need 12+)"; exit 1 }
if ($pin.Trim().Length -lt 8) { Write-Error "PIN too short (need 8+)"; exit 1 }
if ($email -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { Write-Error "invalid email"; exit 1 }

$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($pw, [Text.Encoding]::UTF8.GetBytes($salt), 10000, [Security.Cryptography.HashAlgorithmName]::SHA512)
$pwHash = -join ($kdf.GetBytes(64) | ForEach-Object { $_.ToString("x2") })

$sha = [Security.Cryptography.SHA256]::Create()
$pinHash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($pin.Trim())) | ForEach-Object { $_.ToString("x2") })

$values = @{
  PENRX_ADMIN_EMAIL         = $email
  PENRX_ADMIN_SALT          = $salt
  PENRX_ADMIN_PASSWORD_HASH = $pwHash
  PENRX_ADMIN_PIN_HASH      = $pinHash
}

$lines = Get-Content $EnvFile
foreach ($key in $values.Keys) {
  $pattern = '^\s*#?\s*(export\s+)?' + $key + '\s*='
  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match $pattern) { $idx = $i; break } }
  if ($idx -ge 0) { $lines[$idx] = "$key=$($values[$key])" }
  else { $lines += "$key=$($values[$key])" }
}
# WriteAllLines = UTF-8 without BOM.  Set-Content -Encoding UTF8 on Windows
# PowerShell 5.1 emits a BOM, which would corrupt the first KEY of the .env file.
[IO.File]::WriteAllLines((Resolve-Path $EnvFile), $lines)

Write-Host ""
Write-Host "written to $EnvFile : PENRX_ADMIN_EMAIL, PENRX_ADMIN_SALT, PENRX_ADMIN_PASSWORD_HASH, PENRX_ADMIN_PIN_HASH"
Write-Host "values were not printed. Run:  node scripts/push-vercel-env.js --project=pen-rx --file=$EnvFile --check"
