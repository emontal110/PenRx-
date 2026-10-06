Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\logo-penrx.jpg"
if (-not (Test-Path $srcPath)) {
    $srcPath = Join-Path $PSScriptRoot "..\public\logo-penrx.jpg"
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Source image loaded successfully."

$resDir = Join-Path $PSScriptRoot "..\android\app\src\main\res"
$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#1C252A")

$adaptiveDensities = @{
    "mipmap-mdpi"    = @{ Canvas = 108; Logo = 62 }
    "mipmap-hdpi"    = @{ Canvas = 162; Logo = 92 }
    "mipmap-xhdpi"   = @{ Canvas = 216; Logo = 124 }
    "mipmap-xxhdpi"  = @{ Canvas = 324; Logo = 186 }
    "mipmap-xxxhdpi" = @{ Canvas = 432; Logo = 248 }
}

$legacyDensities = @{
    "mipmap-mdpi"    = @{ Canvas = 48;  Logo = 36 }
    "mipmap-hdpi"    = @{ Canvas = 72;  Logo = 54 }
    "mipmap-xhdpi"   = @{ Canvas = 96;  Logo = 72 }
    "mipmap-xxhdpi"  = @{ Canvas = 144; Logo = 108 }
    "mipmap-xxxhdpi" = @{ Canvas = 192; Logo = 144 }
}

function Create-Centered-Icon([int]$canvasSize, [int]$logoSize, [System.Drawing.Color]$bg, [bool]$isRound, [bool]$isTransparent) {
    $target = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($isTransparent) {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $brush = New-Object System.Drawing.SolidBrush($bg)
        if ($isRound) {
            $g.Clear([System.Drawing.Color]::Transparent)
            $g.FillEllipse($brush, 0, 0, $canvasSize, $canvasSize)
        } else {
            $g.Clear([System.Drawing.Color]::Transparent)
            $radius = [int]($canvasSize * 0.22)
            $path = New-Object System.Drawing.Drawing2D.GraphicsPath
            $rect = New-Object System.Drawing.Rectangle(0, 0, $canvasSize, $canvasSize)
            $path.AddArc($rect.X, $rect.Y, $radius * 2, $radius * 2, 180, 90)
            $path.AddArc($rect.Right - $radius * 2, $rect.Y, $radius * 2, $radius * 2, 270, 90)
            $path.AddArc($rect.Right - $radius * 2, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 0, 90)
            $path.AddArc($rect.X, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 90, 90)
            $path.CloseFigure()
            $g.FillPath($brush, $path)
            $path.Dispose()
        }
        $brush.Dispose()
    }

    # Center the logo in the middle
    $offsetX = [int](($canvasSize - $logoSize) / 2)
    $offsetY = [int](($canvasSize - $logoSize) / 2)

    $g.DrawImage($srcBmp, $offsetX, $offsetY, $logoSize, $logoSize)
    $g.Dispose()

    return $target
}

# 1. Generate Adaptive Foreground icons
foreach ($key in $adaptiveDensities.Keys) {
    $info = $adaptiveDensities[$key]
    $cSize = $info["Canvas"]
    $lSize = $info["Logo"]
    $folderPath = Join-Path $resDir $key

    if (-not (Test-Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    }

    $fg = Create-Centered-Icon $cSize $lSize $bgColor $false $true
    $fgPath = Join-Path $folderPath "ic_launcher_foreground.png"
    $fg.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose()
    Write-Host "Generated $key/ic_launcher_foreground.png"
}

# 2. Generate Legacy Icons
foreach ($key in $legacyDensities.Keys) {
    $info = $legacyDensities[$key]
    $cSize = $info["Canvas"]
    $lSize = $info["Logo"]
    $folderPath = Join-Path $resDir $key

    $std = Create-Centered-Icon $cSize $lSize $bgColor $false $false
    $stdPath = Join-Path $folderPath "ic_launcher.png"
    $std.Save($stdPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $std.Dispose()

    $rnd = Create-Centered-Icon $cSize $lSize $bgColor $true $false
    $rndPath = Join-Path $folderPath "ic_launcher_round.png"
    $rnd.Save($rndPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $rnd.Dispose()

    Write-Host "Generated $key/ic_launcher.png and ic_launcher_round.png"
}

$srcBmp.Dispose()
Write-Host "All Android icons updated successfully!"
