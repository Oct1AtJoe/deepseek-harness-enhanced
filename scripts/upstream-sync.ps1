# upstream-sync.ps1 — sync the local upstream mirror line and merge into master
#
# This checkout keeps TWO branches:
#   upstream-master — a local mirror of official master. Each sync appends ONE
#       snapshot commit (tree = official master tarball). This line is the
#       merge base for three-way merges; it is NOT the real upstream history
#       (SHAs differ), so never push it anywhere.
#   master — the working branch: latest official snapshot + local
#       customizations (see CUSTOM-FEATURES.md).
#
# Why not `git fetch upstream`? github.com:443 is unstable on this network;
# codeload.github.com:443 answers reliably, so the snapshot is downloaded as
# a tarball. If plain `git fetch upstream master` starts working, this script
# can be replaced by fetch + merge.
#
# Usage: powershell -File scripts/upstream-sync.ps1
# After a merge, resolve conflicts per CUSTOM-FEATURES.md (apiproxy,
# ui-conversation, ui-deliverables are the hot spots), run the package tests,
# then `git push origin master`.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path $env:TEMP 'dsh-upstream-sync'
$tar = Join-Path $tmp 'upstream.tar.gz'
$extract = Join-Path $tmp 'extract'
$tarballUrl = 'https://codeload.github.com/deepseek-ai/deepseek-harness/tar.gz/refs/heads/master'

Push-Location $repoRoot
try {
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null

    Write-Host "[1/5] downloading official master tarball..."
    curl.exe -L --fail --max-time 600 -o $tar $tarballUrl
    if ($LASTEXITCODE -ne 0) { throw "tarball download failed (exit $LASTEXITCODE)" }

    Write-Host "[2/5] extracting..."
    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    tar -xzf $tar -C $extract
    $src = Get-ChildItem $extract -Directory | Select-Object -First 1
    if ($null -eq $src) { throw 'tarball did not extract a root directory' }

    Write-Host "[3/5] committing snapshot on upstream-master..."
    git checkout upstream-master 2>$null
    git rm -rf --quiet . 2>$null
    robocopy $src.FullName . /E /IS /IT /SL /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }
    git add -A
    $stamp = Get-Date -Format 'yyyy-MM-dd'
    git commit -q -m "upstream master snapshot: $stamp"

    Write-Host "[4/5] merging snapshot into master..."
    git checkout master 2>$null
    git merge upstream-master -m "merge upstream snapshot $stamp"

    Write-Host "[5/5] done. Working tree now holds official master + local customizations."
    Write-Host "If the merge reported conflicts, resolve them per CUSTOM-FEATURES.md,"
    Write-Host "run pnpm run test:gui, then: git push origin master"
}
finally {
    Pop-Location
}
