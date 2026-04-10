# =====================================================
# DEPLOY SCRIPT - Phieu Tra Loi Trac Nghiem Thong Minh
# Build → Deploy Vercel → Sync Android
# =====================================================

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DONG BO WEB + ANDROID" -ForegroundColor Cyan
Write-Host "  Phieu Tra Loi Trac Nghiem Thong Minh" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# STEP 1: BUILD
Write-Host "[1/3] Building production bundle..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ BUILD THAT BAI! Kiem tra loi o tren." -ForegroundColor Red
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-Host "✅ Build thanh cong!" -ForegroundColor Green
Write-Host ""

# STEP 2: DEPLOY VERCEL
Write-Host "[2/3] Deploying to Vercel (production)..." -ForegroundColor Yellow
vercel --prod --yes
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ DEPLOY VERCEL THAT BAI!" -ForegroundColor Red
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-Host "✅ Deploy Vercel thanh cong!" -ForegroundColor Green
Write-Host ""

# STEP 3: SYNC ANDROID
Write-Host "[3/3] Syncing Android app..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ SYNC ANDROID THAT BAI!" -ForegroundColor Red
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-Host "✅ Sync Android thanh cong!" -ForegroundColor Green
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ✅ DONG BO HOAN TAT!" -ForegroundColor Green
Write-Host "  🌐 Web: https://phieutraloitracnghiem.vercel.app" -ForegroundColor White
Write-Host "  📱 Android: Mo Android Studio > Run" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Nhan Enter de dong"
