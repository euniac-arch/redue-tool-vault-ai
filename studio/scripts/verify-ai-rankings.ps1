#Requires -Version 5.1
<#
.SYNOPSIS
  Load a daily AI rankings JSON snapshot and check share figures.

.DESCRIPTION
  Resolves *ai-rankings.json from $PSScriptRoot (or -JsonPath), then a
  recursive project search. Exits 1 when the file is missing or unreadable.

.EXAMPLE
  pwsh -File .\scripts\verify-ai-rankings.ps1
  pwsh -File .\scripts\verify-ai-rankings.ps1 -JsonPath .\data\ai-rankings.json
#>
[CmdletBinding()]
param(
    [string]$JsonPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-RankingsFile {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    try {
        return Test-Path -LiteralPath $Path -PathType Leaf
    } catch {
        return $false
    }
}

function Get-FullRankingsPath {
    param([string]$Path)
    # Test-Path must succeed first. GetFullPath does not call Get-Item, so a
    # missing file cannot surface as ItemNotFoundException.
    if (-not (Test-RankingsFile $Path)) { return $null }
    return [System.IO.Path]::GetFullPath($Path)
}

function Resolve-AiRankingsFile {
    param([string]$RequestedPath)

    if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) {
        return $null
    }

    if ($RequestedPath) {
        $requested = if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
            $RequestedPath
        } else {
            Join-Path -Path $PSScriptRoot -ChildPath $RequestedPath
        }
        return (Get-FullRankingsPath $requested)
    }

    $relativeCandidates = @(
        (Join-Path $PSScriptRoot 'ai-rankings.json'),
        (Join-Path $PSScriptRoot 'data\ai-rankings.json'),
        (Join-Path $PSScriptRoot '..\data\ai-rankings.json')
    )
    foreach ($candidate in $relativeCandidates) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        $full = Get-FullRankingsPath $candidate
        if ($full) { return $full }
    }

    $snapshotDirs = @(
        (Join-Path $PSScriptRoot '..\.data\ai-rankings\daily'),
        (Join-Path $PSScriptRoot '..\..\.data\ai-rankings\daily')
    )
    foreach ($dir in $snapshotDirs) {
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
        $latest = Get-ChildItem -LiteralPath $dir -Filter '*.json' -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($null -ne $latest -and (Test-RankingsFile $latest.FullName)) {
            return $latest.FullName
        }
    }

    $projectRootCandidate = Join-Path $PSScriptRoot '..\..'
    if (-not (Test-Path -LiteralPath $projectRootCandidate -PathType Container)) {
        return $relativeCandidates[0]
    }
    $projectRoot = [System.IO.Path]::GetFullPath($projectRootCandidate)
    $skipDirs = @('node_modules', '.git', '.next')
    $matches = @(Get-ChildItem -LiteralPath $projectRoot -Filter '*ai-rankings.json' -File -ErrorAction SilentlyContinue)
    $childDirs = @(Get-ChildItem -LiteralPath $projectRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $skipDirs -notcontains $_.Name })
    foreach ($dir in $childDirs) {
        if (-not (Test-Path -LiteralPath $dir.FullName -PathType Container)) { continue }
        $matches += @(Get-ChildItem -LiteralPath $dir.FullName -Filter '*ai-rankings.json' -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '[\\/](node_modules|\.git|\.next)[\\/]' })
    }
    $found = $matches | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -ne $found -and (Test-RankingsFile $found.FullName)) {
        return $found.FullName
    }

    return $relativeCandidates[0]
}

function Fail-MissingOrInvalid {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

$resolvedPath = $null
try {
    $resolvedPath = Resolve-AiRankingsFile -RequestedPath $JsonPath
} catch [System.Management.Automation.ItemNotFoundException] {
    Fail-MissingOrInvalid "AI rankings JSON path could not be resolved from '$PSScriptRoot': $($_.Exception.Message)"
} catch {
    Fail-MissingOrInvalid "AI rankings JSON path lookup failed: $($_.Exception.Message)"
}

if (-not (Test-RankingsFile $resolvedPath)) {
    $shownPath = if ($resolvedPath) { $resolvedPath } elseif ($JsonPath) { $JsonPath } else { Join-Path $PSScriptRoot 'ai-rankings.json' }
    Fail-MissingOrInvalid @"
AI rankings JSON was not found.
Looked under '$PSScriptRoot' (ai-rankings.json, .data/ai-rankings/daily/*.json) and recursively for *ai-rankings.json.
Resolved path: $shownPath
Pass -JsonPath to point at a snapshot, or place ai-rankings.json beside this script.
"@
}

try {
    $raw = [System.IO.File]::ReadAllText($resolvedPath, [System.Text.Encoding]::UTF8)
    if ([string]::IsNullOrWhiteSpace($raw)) {
        Fail-MissingOrInvalid "AI rankings JSON is empty: $resolvedPath"
    }
    $data = $raw | ConvertFrom-Json
} catch {
    Fail-MissingOrInvalid "Failed to read or parse UTF-8 JSON at '$resolvedPath': $($_.Exception.Message)"
}

function Get-ToolProp {
    param($Tool, [string]$Name)
    $prop = $Tool.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

$tools = @()
if ($null -ne $data.PSObject.Properties['tools']) {
    $tools = @($data.tools)
}
if ($tools.Count -eq 0) {
    Fail-MissingOrInvalid "Parsed '$resolvedPath' but .tools is missing or empty."
}

function Round1([double]$Value) {
    return [Math]::Round($Value, 1)
}

function Normalize-SharePct([double]$Index, [double]$Total) {
    if ($Total -le 0 -or $Index -le 0) { return 0.0 }
    return (Round1 (($Index / $Total) * 100))
}

$rankErrors = @()
$totalTraffic = 0.0
foreach ($tool in $tools) {
    $traffic = Get-ToolProp $tool 'trafficIndex'
    if ($null -ne $traffic) { $totalTraffic += [Math]::Max(0, [double]$traffic) }
    $catRank = Get-ToolProp $tool 'categoryRank'
    $globalRank = Get-ToolProp $tool 'currentRank'
    $id = Get-ToolProp $tool 'id'
    if ($null -eq $catRank -or [int]$catRank -lt 1) { $rankErrors += "$id categoryRank missing" }
    if ($null -eq $globalRank -or [int]$globalRank -lt 1) { $rankErrors += "$id currentRank missing" }
}

$shareMismatches = @()
$shareChecked = 0
foreach ($tool in $tools) {
    $actualRaw = Get-ToolProp $tool 'globalSharePct'
    if ($null -eq $actualRaw) { continue }
    $shareChecked += 1
    $traffic = Get-ToolProp $tool 'trafficIndex'
    $expected = Normalize-SharePct ([double]$traffic) $totalTraffic
    $actual = Round1 ([double]$actualRaw)
    if ($expected -ne $actual) {
        $name = Get-ToolProp $tool 'name'
        if (-not $name) { $name = Get-ToolProp $tool 'id' }
        $shareMismatches += "${name}: globalSharePct $actual != recomputed $expected"
    }
}

Write-Host "Loaded $resolvedPath"
$dateLabel = Get-ToolProp $data 'date'
Write-Host ("Date {0} · tools {1}" -f $dateLabel, $tools.Count)
if ($rankErrors.Count -gt 0) {
    Write-Host "ERROR: rank fields missing on $($rankErrors.Count) tool(s):" -ForegroundColor Red
    $rankErrors | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
    exit 1
}
if ($shareMismatches.Count -gt 0) {
    Write-Host "ERROR: global share does not match traffic / total for $($shareMismatches.Count) tool(s):" -ForegroundColor Red
    $shareMismatches | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
    exit 1
}

if ($shareChecked -gt 0) {
    Write-Host "OK  categoryRank/currentRank present and globalSharePct matches traffic share for $shareChecked tools."
} else {
    Write-Host "OK  categoryRank/currentRank present for $($tools.Count) tools (snapshot has no globalSharePct)."
}
exit 0
