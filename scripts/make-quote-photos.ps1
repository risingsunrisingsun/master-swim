# 어록 카드에 쓰는 선수 사진을 만든다. 저장소 루트에서 실행한다:
#   powershell -ExecutionPolicy Bypass -File scripts\make-quote-photos.ps1
#
# 원본은 `assets/quotes/*.jpg` — 위키미디어 공용에서 받은 자유 라이선스 사진이다.
# 라이선스와 촬영자는 `src/quotes.ts` 에 파일별로 적혀 있고, 화면에도 함께 뜬다.
#
# 얼굴 위치가 사진마다 다르다. 자동으로 맞출 방법이 없어 **파일별로 손으로 잡았다** —
# CenterX/CenterY 는 잘라낼 정사각형의 중심(원본 크기 대비 비율), Zoom 은 한 변의
# 길이(짧은 변 대비 비율)다. 사진을 바꾸면 여기 세 숫자를 다시 잡아야 한다.
param([string]$SrcDir = 'assets/quotes', [string]$OutDir = 'web/quotes', [int]$Size = 200)

Add-Type -AssemblyName System.Drawing

$frames = @{
  phelps   = @{ X = 0.46; Y = 0.42; Zoom = 0.86 }
  ledecky  = @{ X = 0.49; Y = 0.23; Zoom = 0.30 }
  dressel  = @{ X = 0.55; Y = 0.27; Zoom = 0.46 }
  thorpe   = @{ X = 0.50; Y = 0.27; Zoom = 0.50 }
  sjostrom = @{ X = 0.50; Y = 0.35; Zoom = 0.68 }
  hwang    = @{ X = 0.48; Y = 0.34; Zoom = 0.64 }
  kim      = @{ X = 0.50; Y = 0.30; Zoom = 0.62 }
  ikee     = @{ X = 0.56; Y = 0.26; Zoom = 0.40 }
  park     = @{ X = 0.555; Y = 0.28; Zoom = 0.27 }
  milak    = @{ X = 0.475; Y = 0.23; Zoom = 0.32 }
  lochte   = @{ X = 0.55; Y = 0.37; Zoom = 0.78 }
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

# JPEG 품질을 직접 지정한다. 기본값(75)은 200px 얼굴에서 눈에 띄게 뭉갠다.
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82

'생성:'
foreach ($file in Get-ChildItem "$SrcDir\*.jpg") {
  $name = $file.BaseName
  $src = [System.Drawing.Bitmap]::FromFile($file.FullName)
  $frame = if ($frames.ContainsKey($name)) { $frames[$name] } else { @{ X = 0.5; Y = 0.3; Zoom = 0.7 } }

  $side = [int]([math]::Min($src.Width, $src.Height) * $frame.Zoom)
  # 잘라낼 사각형이 원본 밖으로 나가지 않게 가둔다.
  $x = [int][math]::Max(0, [math]::Min($src.Width - $side, $src.Width * $frame.X - $side / 2))
  $y = [int][math]::Max(0, [math]::Min($src.Height - $side, $src.Height * $frame.Y - $side / 2))
  $crop = New-Object System.Drawing.Rectangle $x, $y, $side, $side

  $out = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.SmoothingMode = 'AntiAlias'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size), $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  $path = Join-Path (Resolve-Path $OutDir) "$name.jpg"
  $out.Save($path, $codec, $params)
  $out.Dispose()
  $src.Dispose()

  "  {0,-14} {1}x{1}  {2:N0} bytes" -f "$name.jpg", $Size, (Get-Item $path).Length
}
