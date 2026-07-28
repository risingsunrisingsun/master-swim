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
#
# 아이콘과 달리 **배경을 투명하게** 만든다. 흰 배경 그대로 두면 시작 화면의
# 회색 바탕 위에 흰 사각형이 떠서 로고가 오려 붙인 것처럼 보인다.
$logoCrop = New-Object System.Drawing.Rectangle 450, 34, 186, 136
$logo = New-Object System.Drawing.Bitmap 558, 408, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$lg = [System.Drawing.Graphics]::FromImage($logo)
$lg.SmoothingMode = 'AntiAlias'
$lg.InterpolationMode = 'HighQualityBicubic'
$lg.PixelOffsetMode = 'HighQuality'
$lg.Clear([System.Drawing.Color]::White)
$lg.DrawImage($src, (New-Object System.Drawing.RectangleF 0, 0, 558, 408), $logoCrop, [System.Drawing.GraphicsUnit]::Pixel)
$lg.Dispose()

# 흰 배경을 알파로 바꾼다. 원본은 흰 바탕에 파란 잉크이므로
#   alpha = 255 - min(R,G,B)
# 로 잉크의 진하기를 얻고, 흰색과 합성되기 전 색으로 되돌린다(un-premultiply).
# 이렇게 해야 계단 현상 없이 어떤 배경색 위에도 얹을 수 있다.
$rect = New-Object System.Drawing.Rectangle 0, 0, $logo.Width, $logo.Height
$data = $logo.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($data.Stride * $logo.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
for ($i = 0; $i -lt $bytes.Length; $i += 4) {
  # BGRA 순서로 들어 있다.
  $b = $bytes[$i]; $g = $bytes[$i + 1]; $r = $bytes[$i + 2]
  $alpha = 255 - [math]::Min($r, [math]::Min($g, $b))
  if ($alpha -le 2) {
    $bytes[$i] = 0; $bytes[$i + 1] = 0; $bytes[$i + 2] = 0; $bytes[$i + 3] = 0
  } else {
    $white = 255 - $alpha
    $bytes[$i]     = [byte][math]::Max(0, [math]::Min(255, [math]::Round(($b - $white) * 255 / $alpha)))
    $bytes[$i + 1] = [byte][math]::Max(0, [math]::Min(255, [math]::Round(($g - $white) * 255 / $alpha)))
    $bytes[$i + 2] = [byte][math]::Max(0, [math]::Min(255, [math]::Round(($r - $white) * 255 / $alpha)))
    $bytes[$i + 3] = [byte]$alpha
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$logo.UnlockBits($data)

$logo.Save("$OutDir\logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$logo.Dispose()
'  logo.png                     558x408  (워드마크 포함 · 배경 투명)'

$src.Dispose()
