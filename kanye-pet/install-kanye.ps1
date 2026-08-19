<#
.SYNOPSIS
    Install Kanye West pet character into whale-girl plugin.
.DESCRIPTION
    Patches the whale-girl plugin to add the Kanye West character.
    Run this after installing whale-girl via `dsh plugin --profile web add`.
.EXAMPLE
    .\install-kanye.ps1
    .\install-kanye.ps1 -Size 200
#>
param(
    [int]$Size = 200,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# --- Find whale-girl plugin directory ---
$candidates = @(
    "$env:USERPROFILE\.dsh\profiles\web\node_modules\whale-girl",
    "$env:USERPROFILE\.dsh\profiles\web\plugins\whale-girl",
    "$env:DSH_HOME\profiles\web\node_modules\whale-girl",
    "$env:DSH_HOME\plugins\whale-girl"
)

$whaleGirl = foreach ($c in $candidates) {
    if (Test-Path "$c\lib\index.mjs") { $c; break }
}

if (-not $whaleGirl) {
    Write-Host "ERROR: whale-girl plugin not found." -ForegroundColor Red
    Write-Host "Install it first: dsh plugin --profile web add 'github:vlln/whale-girl#main'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found whale-girl at: $whaleGirl" -ForegroundColor Cyan

# --- Paths ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$kanyeAssets = Join-Path $scriptDir "assets\characters\kanye"
$manifestSrc = Join-Path $scriptDir "assets\manifest.json"
$destDir = Join-Path $whaleGirl "lib\assets\characters\kanye"
$whaleManifest = Join-Path $whaleGirl "lib\assets\manifest.json"
$indexMjs = Join-Path $whaleGirl "lib\index.mjs"

# --- Step 1: Copy Kanye sprite sheets ---
Write-Host "`n[1/4] Copying Kanye sprite sheets..." -ForegroundColor Green
if (-not (Test-Path $kanyeAssets)) {
    Write-Host "ERROR: Kanye assets not found at $kanyeAssets" -ForegroundColor Red
    exit 1
}
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
Copy-Item "$kanyeAssets\*.png" -Destination $destDir -Force
$count = (Get-ChildItem "$destDir\*.png").Count
Write-Host "  Copied $count sprite sheets to $destDir"

# --- Step 2: Patch manifest.json ---
Write-Host "`n[2/4] Patching manifest.json..." -ForegroundColor Green
if (-not (Test-Path $whaleManifest)) {
    Write-Host "ERROR: whale-girl manifest.json not found" -ForegroundColor Red
    exit 1
}

$whaleJson = Get-Content $whaleManifest -Raw -Encoding UTF8 | ConvertFrom-Json
$kanyeJson = Get-Content $manifestSrc -Raw -Encoding UTF8 | ConvertFrom-Json

# Check if kanye already exists
if ($whaleJson.characters.kanye -and -not $Force) {
    Write-Host "  Kanye character already exists. Use -Force to overwrite." -ForegroundColor Yellow
} else {
    # Merge kanye character into whale-girl manifest
    $whaleJson.characters | Add-Member -NotePropertyName "kanye" -NotePropertyValue $kanyeJson.characters.kanye -Force
    $whaleJson | ConvertTo-Json -Depth 10 | Set-Content $whaleManifest -Encoding UTF8
    Write-Host "  Added Kanye character to manifest.json"
}

# --- Step 3: Patch index.mjs (manifest cache: immutable → no-cache) ---
Write-Host "`n[3/4] Patching server cache settings..." -ForegroundColor Green
$indexContent = Get-Content $indexMjs -Raw -Encoding UTF8
$oldLine = 'res.writeHead(200, { ''content-type'': contentTypeFor(rel), ''cache-control'': ''public, max-age=31536000, immutable'' })'
$newLine = 'const cacheCtrl = rel === ''manifest.json'' ? ''no-cache, must-revalidate'' : ''public, max-age=31536000, immutable''' + "`n" + '            res.writeHead(200, { ''content-type'': contentTypeFor(rel), ''cache-control'': cacheCtrl })'

if ($indexContent -like '*no-cache, must-revalidate*') {
    Write-Host "  Cache patch already applied." -ForegroundColor Yellow
} else {
    $indexContent = $indexContent.Replace($oldLine, $newLine)
    $indexContent | Set-Content $indexMjs -Encoding UTF8
    Write-Host "  Patched index.mjs: manifest.json now uses no-cache"
}

# --- Step 4: Update settings.yaml ---
Write-Host "`n[4/4] Updating settings.yaml..." -ForegroundColor Green
$settingsPath = "$env:USERPROFILE\.dsh\settings.yaml"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw -Encoding UTF8
    if ($settings -like '*whale-girl:*') {
        Write-Host "  whale-girl section already exists in settings.yaml" -ForegroundColor Yellow
    } else {
        $settings += "`nwhale-girl:`n  size: $Size`n"
        $settings | Set-Content $settingsPath -Encoding UTF8
        Write-Host "  Added whale-girl: size: $Size to settings.yaml"
    }
} else {
    Write-Host "  WARNING: settings.yaml not found at $settingsPath" -ForegroundColor Yellow
}

# --- Done ---
Write-Host "`n=== Kanye West pet installed! ===" -ForegroundColor Cyan
Write-Host "Restart DSH web and refresh the page:" -ForegroundColor White
Write-Host "  dsh --profile web restart" -ForegroundColor Yellow
Write-Host ""
Write-Host "Troubleshooting:" -ForegroundColor White
Write-Host "  - If pet doesn't change: hard refresh (Ctrl+Shift+R)" -ForegroundColor Gray
Write-Host "  - If button gray: clear browser cache for the site" -ForegroundColor Gray
Write-Host "  - Change size: edit settings.yaml whale-girl.size" -ForegroundColor Gray
