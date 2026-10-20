# Generates every app asset from the brand artwork using System.Drawing (no npm dependencies).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/make-brand-assets.ps1 [-Source assets/brand/icon-source.png]
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\assets\brand\icon-source.png')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Source))

function New-Canvas([int]$w, [int]$h, [System.Drawing.Color]$bg) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @($bmp, $g)
}

function Save([System.Drawing.Bitmap]$bmp, [string]$name) {
  $path = Join-Path $assets $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "wrote $name ($($bmp.Width)x$($bmp.Height))"
}

# --- locate the teal tile inside the artwork (pixels where blue clearly exceeds red) ---
function Is-Teal([System.Drawing.Color]$c) { return (($c.B - $c.R) -gt 40) -and ($c.R -lt 120) }
$midY = [int]($src.Height / 2); $midX = [int]($src.Width / 2)
$x0 = 0; while ($x0 -lt $src.Width -and -not (Is-Teal $src.GetPixel($x0, $midY))) { $x0++ }
$x1 = $src.Width - 1; while ($x1 -gt $x0 -and -not (Is-Teal $src.GetPixel($x1, $midY))) { $x1-- }
$y0 = 0; while ($y0 -lt $src.Height -and -not (Is-Teal $src.GetPixel($midX, $y0))) { $y0++ }
$y1 = $src.Height - 1; while ($y1 -gt $y0 -and -not (Is-Teal $src.GetPixel($midX, $y1))) { $y1-- }
$tile = New-Object System.Drawing.Rectangle $x0, $y0, ($x1 - $x0 + 1), ($y1 - $y0 + 1)
Write-Host "teal tile at $($tile.X),$($tile.Y) size $($tile.Width)x$($tile.Height)"
$tileBmp = $src.Clone($tile, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$white = [System.Drawing.Color]::White
$transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)

# 1. icon.png — full artwork, 1024x1024 (iOS rounds the corners itself)
$c = New-Canvas 1024 1024 $white
$c[1].DrawImage($src, 0, 0, 1024, 1024); Save $c[0] 'icon.png'

# 2. adaptive-icon.png — full artwork; the teal tile sits inside Android's 66% safe zone
$c = New-Canvas 1024 1024 $transparent
$c[1].DrawImage($src, 0, 0, 1024, 1024); Save $c[0] 'adaptive-icon.png'

# 3. splash.png — teal tile with rounded corners, centred on transparent (background colour comes from app.json)
$c = New-Canvas 1024 1024 $transparent
$size = 560; $off = (1024 - $size) / 2; $r = 72
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($off, $off, $r * 2, $r * 2, 180, 90)
$path.AddArc($off + $size - $r * 2, $off, $r * 2, $r * 2, 270, 90)
$path.AddArc($off + $size - $r * 2, $off + $size - $r * 2, $r * 2, $r * 2, 0, 90)
$path.AddArc($off, $off + $size - $r * 2, $r * 2, $r * 2, 90, 90)
$path.CloseFigure()
$c[1].SetClip($path)
$c[1].DrawImage($tileBmp, $off, $off, $size, $size); Save $c[0] 'splash.png'

# 4. favicon.png — teal tile, 48x48
$c = New-Canvas 48 48 $transparent
$c[1].DrawImage($tileBmp, 0, 0, 48, 48); Save $c[0] 'favicon.png'

# 5. notification-icon.png — Android needs a white-on-transparent alpha mask: keep the light shapes of the tile
$n = 96
$small = New-Canvas $n $n $transparent
$small[1].DrawImage($tileBmp, 0, 0, $n, $n)
$mask = New-Object System.Drawing.Bitmap $n, $n, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $n; $y++) {
  for ($x = 0; $x -lt $n; $x++) {
    $p = $small[0].GetPixel($x, $y)
    $lum = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B)
    # map luminance 120..230 → alpha 0..255 so edges stay smooth
    $a = [int][Math]::Max(0, [Math]::Min(255, ($lum - 120) * 255 / 110))
    $mask.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, 255, 255, 255))
  }
}
Save $mask 'notification-icon.png'

$src.Dispose()
Write-Host 'done'
