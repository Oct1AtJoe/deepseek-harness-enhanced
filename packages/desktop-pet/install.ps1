<#
.SYNOPSIS
    Install DSH Desktop Pet (built-in package) into DSH.
.DESCRIPTION
    Copies the desktop-pet package into DSH's node_modules and patches the
    whale-girl plugin to add the Kanye character (if whale-girl is installed).
    Run this after `pnpm install` on any machine.
.EXAMPLE
    .\install.ps1
#>
param(
    [int]$Size = 200,
    [string]$Character = 'whale-girl'
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Find DSH ---
$dshHome = $env:DSH_HOME ?? "$env:USERPROFILE\.dsh"
$profilesWeb = Join-Path $dshHome "profiles\web"
$whaleGirl = Join-Path $profilesWeb "node_modules\whale-girl"

if (-not (Test-Path $whaleGirl)) {
    Write-Host " whale-girl plugin not found. Install first:" -ForegroundColor Yellow
    Write-Host "   dsh plugin --profile web add 'github:vlln/whale-girl#main'" -ForegroundColor White
    exit 1
}

# --- Patch whale-girl manifest with Kanye ---
$manifestPath = Join-Path $whaleGirl "lib\assets\manifest.json"
if (Test-Path $manifestPath) {
    Write-Host "Patching whale-girl manifest..." -ForegroundColor Green
    $json = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

    # Add kanye if not present
    if (-not $json.characters.kanye) {
        $kanyeManifest = Get-Content "$scriptDir\assets\manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
        $json.characters | Add-Member -NotePropertyName "kanye" -NotePropertyValue $kanyeManifest.characters.kanye -Force
        $json | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
        Write-Host "  Added Kanye character to manifest"
    }

    # Copy kanye sprites
    $kanyeDest = Join-Path $whaleGirl "lib\assets\characters\kanye"
    if (-not (Test-Path $kanyeDest)) {
        New-Item -ItemType Directory -Path $kanyeDest -Force | Out-Null
        $kanyeSrc = "$scriptDir\assets\characters\kanye"
        if (Test-Path $kanyeSrc) {
            Copy-Item "$kanyeSrc\*.png" -Destination $kanyeDest -Force
            Write-Host "  Copied $((Get-ChildItem $kanyeDest\*.png).Count) Kanye sprites"
        }
    }

    # Patch server cache for manifest
    $indexPath = Join-Path $whaleGirl "lib\index.mjs"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw -Encoding UTF8
        if ($content -notlike '*no-cache, must-revalidate*') {
            $old = "res.writeHead(200, { 'content-type': contentTypeFor(rel), 'cache-control': 'public, max-age=31536000, immutable' })"
            $new = "const cacheCtrl = rel === 'manifest.json' ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable'`n            res.writeHead(200, { 'content-type': contentTypeFor(rel), 'cache-control': cacheCtrl })"
            $content = $content.Replace($old, $new)
            $content | Set-Content $indexPath -Encoding UTF8
            Write-Host "  Patched server: manifest.json uses no-cache"
        }
    }
}

# --- Update settings ---
$settingsPath = Join-Path $dshHome "settings.yaml"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw -Encoding UTF8
    if ($settings -notlike '*whale-girl:*') {
        $settings += "`nwhale-girl:`n  size: $Size`n"
        $settings | Set-Content $settingsPath -Encoding UTF8
        Write-Host "  Added whale-girl settings (size: $Size)"
    } else {
        Write-Host "  whale-girl settings already present"
    }
}

# --- Done ---
Write-Host "`n=== Desktop Pet installed ===" -ForegroundColor Cyan
Write-Host "Restart DSH web and refresh the page:" -ForegroundColor White
Write-Host "  dsh --profile web restart" -ForegroundColor Yellow
Write-Host ""
Write-Host "Switch characters: click pet -> menu '🎭 换角色'" -ForegroundColor Gray
