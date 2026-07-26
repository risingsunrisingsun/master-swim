# 팀 로고에서 PWA 아이콘을 만든다. 저장소 루트에서 실행한다:
#   powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
#
# 원본(260301.png)은 1080x220 배너다. 로고 잉크는 x 454..630 · y 38..164 에 있고
# 그 안에서 y 38..111 이 "19 + 물결", y 124.. 가 "NINETEEN" 워드마크다.
# 워드마크는 192px 에서 읽히지 않으므로 마크만 잘라 쓴다.
param(
  [string]$Source = 'assets/logo-source.png',
  [string]$OutDir = 'web',
  [int]$CropX = 468, [int]$CropY = 34, [int]$CropW = 168, [int]$CropH = 77
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) { throw "원본을 찾을 수 없습니다: $Source (저장소 루트에서 실행하세요)" }
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Source))
$crop = New-Object System.Drawing.Rectangle $CropX, $CropY, $CropW, $CropH

function New-Icon {
  param([int]$Size, [double]$Fill, [string]$Path)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::White)

  # 원본 비율을 유지한 채 캔버스의 $Fill 비율 안에 들어가도록 맞춘다.
  $box = $Size * $Fill
  $scale = [math]::Min($box / $CropW, $box / $CropH)
  $w = $CropW * $scale
  $h = $CropH * $scale
  $dest = New-Object System.Drawing.RectangleF (($Size - $w) / 2), (($Size - $h) / 2), $w, $h

  $g.DrawImage($src, $dest, $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "  {0,-28} {1}x{1}  채움 {2:P0}" -f (Split-Path $Path -Leaf), $Size, $Fill
}

'생성:'
# 마크가 2.2:1 로 가로가 길다. 폭을 거의 채워야 아이콘이 헐렁해 보이지 않는다.
# 마스커블은 안쪽 80% 원 안에 들어가야 하므로 0.70 이 상한이다
# (모서리 거리 = sqrt(0.35² + 0.16²) = 0.385 < 0.40).
New-Icon -Size 512 -Fill 0.90 -Path "$OutDir\icon-512.png"
New-Icon -Size 192 -Fill 0.90 -Path "$OutDir\icon-192.png"
New-Icon -Size 180 -Fill 0.90 -Path "$OutDir\apple-touch-icon.png"
New-Icon -Size 512 -Fill 0.70 -Path "$OutDir\icon-maskable-512.png"

# 시작 화면용 전체 로고. 아이콘과 달리 NINETEEN 워드마크까지 포함한다 —
# 큰 화면에서는 읽히고, 팀을 알아보는 것이 시작 화면의 목적이다.
$logoCrop = New-Object System.Drawing.Rectangle 450, 34, 186, 136
$logo = New-Object System.Drawing.Bitmap 558, 408, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$lg = [System.Drawing.Graphics]::FromImage($logo)
$lg.SmoothingMode = 'AntiAlias'
$lg.InterpolationMode = 'HighQualityBicubic'
$lg.PixelOffsetMode = 'HighQuality'
$lg.Clear([System.Drawing.Color]::White)
$lg.DrawImage($src, (New-Object System.Drawing.RectangleF 0, 0, 558, 408), $logoCrop, [System.Drawing.GraphicsUnit]::Pixel)
$lg.Dispose()
$logo.Save("$OutDir\logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$logo.Dispose()
'  logo.png                     558x408  (워드마크 포함)'

$src.Dispose()
