#Requires -Version 5.1
<#
.SYNOPSIS
    System tray status monitor for Claude Code sessions.

.DESCRIPTION
    Displays one colored tray icon per active Claude Code session:
      Red    = busy (Claude is working)
      Green  = idle (waiting for your input)
      Orange = attention (permission prompt / notification)

    Hover shows project name, status, and desktop assignment.
    Left-click switches to the session's virtual desktop and focuses the terminal.
    Balloon toast on status transitions (idle/attention) — click to switch + focus.
    Right-click menu: Switch, Assign Desktop, Set Desktop, Dismiss, Exit.

    Optional sound pack support: plays randomized WAV clips on events that need
    your attention (permission prompts, questions, idle nudges, task completion)
    plus fun session bookend sounds. Multiple packs can be loaded simultaneously
    and assigned per-session via right-click menu or config file. Supports
    "random" mode to auto-assign a different pack to each new session.

.PARAMETER StaleMinutes
    Minutes without an update before a session icon is removed. Default: 60.

.PARAMETER PollMs
    How often to scan for state file changes in milliseconds. Default: 1000.

.PARAMETER NoToast
    Disable built-in balloon toast notifications.

.PARAMETER ToastEvents
    Status values that trigger a toast notification. Default: idle, attention.

.PARAMETER SoundPack
    Default sound pack name (e.g., "scv"). All packs in ~/.claude/sounds/packs/ are
    loaded automatically. This parameter sets the fallback when no config or per-session
    assignment exists. Per-session assignment via right-click menu or config.json overrides.

.PARAMETER Silent
    Disable all sound playback (overrides SoundPack).

.PARAMETER SoundCooldownMs
    Per-session cooldown between sounds in milliseconds. Default: 5000.

.PARAMETER SoundComboMs
    Cross-session combo window in milliseconds. If a second session triggers a
    sound within this window, the combo event plays instead. Default: 3000.

.EXAMPLE
    npx just-one -d ~/.just-one -n claude-tray -D -- powershell -NoProfile -ExecutionPolicy Bypass -File claude-tray.ps1

.EXAMPLE
    # With SCV sound pack:
    powershell -File claude-tray.ps1 -SoundPack scv

.EXAMPLE
    # Toast only on permission prompts (not on idle/stop):
    powershell -File claude-tray.ps1 -ToastEvents attention

.NOTES
    Prerequisites:
    - jq on PATH (used by the bash hook, not this script)
    - Optional: Install-Module -Name VirtualDesktop -Scope CurrentUser
    - Optional: WAV files in a sound pack folder for audio notifications
#>

[CmdletBinding()]
param(
    [int]$StaleMinutes = 60,
    [int]$PollMs = 1000,
    [switch]$NoToast,
    [string[]]$ToastEvents = @("idle", "attention", "permission"),
    [string]$SoundPack = "",
    [switch]$Silent,
    [int]$SoundCooldownMs = 5000,
    [int]$SoundComboMs = 3000,
    [switch]$Dry
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Load assemblies ---
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- Script directory (for local sound pack fallback) ---
$script:scriptDir = $PSScriptRoot
if (-not $script:scriptDir) { $script:scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

# --- P/Invoke: SetForegroundWindow ---
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

# --- Single instance guard (fallback if not managed by just-one) ---
$mutexName = "Global\ClaudeTrayMonitor"
$script:mutex = New-Object System.Threading.Mutex($false, $mutexName)
if (-not $script:mutex.WaitOne(0)) {
    Write-Host "Claude tray monitor is already running."
    exit 0
}

# --- State directory ---
$script:trayDir = Join-Path $env:TEMP ".claude-tray"
if (-not (Test-Path $script:trayDir)) {
    New-Item -ItemType Directory -Path $script:trayDir -Force | Out-Null
}

# --- PSVirtualDesktop (optional) ---
$script:hasVirtualDesktop = $false
try {
    Import-Module VirtualDesktop -ErrorAction Stop
    $script:hasVirtualDesktop = $true
} catch {}

# ============================================================
# Icon cache - colored 16x16 circles
# ============================================================
function New-CircleIcon {
    param([System.Drawing.Color]$Color)
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush($Color)
    $g.FillEllipse($brush, 1, 1, 13, 13)
    $brush.Dispose()
    $g.Dispose()
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    return @{ Icon = $icon; Bitmap = $bmp }
}

# Distinct base colors at 16px (bright variants — aging darkens these)
#   busy     = bright red
#   idle     = bright green
#   attention = bright orange (NOT yellow - too close to green at small size)
#   compact  = bright blue (context compaction in progress)
#   permission = bright purple (waiting for tool approval)
$script:baseColors = @{
    "busy"      = [System.Drawing.Color]::FromArgb(230, 40, 40)
    "idle"      = [System.Drawing.Color]::FromArgb(40, 200, 40)
    "attention" = [System.Drawing.Color]::FromArgb(255, 120, 0)
    "compact"   = [System.Drawing.Color]::FromArgb(60, 120, 230)
    "permission"= [System.Drawing.Color]::FromArgb(180, 60, 230)
    "unknown"   = [System.Drawing.Color]::FromArgb(128, 128, 128)
}

# Aging tiers: icons darken based on how long since user last looked (clicked)
# Separate from status age (tooltip). Max darkness at 15 minutes.
# Factor multiplies RGB values (1.0 = full brightness, 0.4 = very dark)
$script:agingTiers = @(
    [pscustomobject]@{ MaxAge = 60;   Factor = 1.0  }   # 0-1m:   bright
    [pscustomobject]@{ MaxAge = 180;  Factor = 0.85 }   # 1-3m:   slightly dimmer
    [pscustomobject]@{ MaxAge = 420;  Factor = 0.70 }   # 3-7m:   noticeably darker
    [pscustomobject]@{ MaxAge = 900;  Factor = 0.55 }   # 7-15m:  dark
    [pscustomobject]@{ MaxAge = [int]::MaxValue; Factor = 0.40 }  # 15m+: very dark
)

# Cache aged icons by "status-factor" key to avoid GDI churn
$script:agedIconCache = @{}

function Get-AgingTier {
    param([int]$Seconds)
    foreach ($tier in $script:agingTiers) {
        if ($Seconds -lt $tier.MaxAge) { return $tier.Factor }
    }
    return 0.4
}

function Get-AgedIcon {
    param([string]$Status, [double]$Factor)
    $key = "$Status-$Factor"
    if ($script:agedIconCache.ContainsKey($key)) {
        return $script:agedIconCache[$key].Icon
    }
    if (-not $script:baseColors.ContainsKey($Status)) { $Status = "unknown" }
    $base = $script:baseColors[$Status]
    $color = [System.Drawing.Color]::FromArgb(
        [int]($base.R * $Factor),
        [int]($base.G * $Factor),
        [int]($base.B * $Factor)
    )
    $entry = New-CircleIcon $color
    $script:agedIconCache[$key] = $entry
    return $entry.Icon
}

# ============================================================
# Sound pack system (multi-pack with per-session assignment)
# ============================================================
$script:loadedPacks = @{}        # packName → @{ eventName → @(filePaths) }
$script:shuffleBags = @{}        # "packName|eventName" → List[string]
$script:lastPlayed = @{}         # "packName|eventName" → lastFilePath
$script:lastGlobalSoundTime = [DateTime]::MinValue
$script:soundPlayer = New-Object System.Media.SoundPlayer
$script:soundConfig = $null
$script:rng = [System.Random]::new()

function Load-SinglePack {
    param([string]$PackName, [string]$PackPath)

    if ($PackName -notmatch '^[a-zA-Z0-9_-]+$') {
        Write-Host "Skipping invalid pack name: '$PackName'"
        return
    }

    try {
        $packJson = Get-Content -Path $PackPath -Raw | ConvertFrom-Json
        $packDir = Split-Path -Parent $PackPath
        $packData = @{}

        foreach ($prop in $packJson.events.PSObject.Properties) {
            $eventName = $prop.Name
            $folder = $prop.Value.folder
            if ($folder -match '[/\\]|\.\.') {
                Write-Host "Skipping event '$eventName' in pack '$PackName': folder contains path separators"
                continue
            }
            $eventDir = Join-Path $packDir $folder
            if (Test-Path $eventDir) {
                $wavFiles = @(Get-ChildItem -Path $eventDir -Filter "*.wav" -ErrorAction SilentlyContinue |
                    ForEach-Object { $_.FullName })
                if ($wavFiles.Count -gt 0) {
                    $packData[$eventName] = $wavFiles
                }
            }
        }

        if ($packData.Count -gt 0) {
            $script:loadedPacks[$PackName] = $packData
            $displayName = $packJson.name
            if (-not $displayName) { $displayName = $PackName }
            Write-Host "  $PackName ($displayName): $($packData.Count) events"
        }
    } catch {
        Write-Host "Failed to load pack '$PackName': $_"
    }
}

function Initialize-SoundPacks {
    if ($Silent) { return }

    # Scan user-scoped packs directory
    $userPacksDir = Join-Path $env:USERPROFILE ".claude\sounds\packs"
    if (Test-Path $userPacksDir) {
        Get-ChildItem -Path $userPacksDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $pj = Join-Path $_.FullName "pack.json"
            if (Test-Path $pj) { Load-SinglePack $_.Name $pj }
        }
    }

    # Scan script-relative packs (don't override user-scoped packs)
    $localPacksDir = Join-Path $script:scriptDir "sounds"
    if (Test-Path $localPacksDir) {
        Get-ChildItem -Path $localPacksDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            if (-not $script:loadedPacks.ContainsKey($_.Name)) {
                $pj = Join-Path $_.FullName "pack.json"
                if (Test-Path $pj) { Load-SinglePack $_.Name $pj }
            }
        }
    }

    # Load config file (~/.claude/sounds/config.json)
    $configPath = Join-Path $env:USERPROFILE ".claude\sounds\config.json"
    if (Test-Path $configPath) {
        try {
            $script:soundConfig = Get-Content -Path $configPath -Raw | ConvertFrom-Json
            Write-Host "Sound config loaded from $configPath"
        } catch {
            Write-Host "Failed to load sound config: $_"
        }
    }

    if ($script:loadedPacks.Count -eq 0) {
        Write-Host "No sound packs found"
    } else {
        Write-Host "Loaded $($script:loadedPacks.Count) sound packs: $($script:loadedPacks.Keys -join ', ')"
    }
}

function Resolve-InitialPack {
    param([string]$ProjectName, [PSCustomObject]$StateData)

    # Priority 1: Persisted override from state file (previous right-click assignment)
    if ($StateData.PSObject.Properties["sound_pack"] -and $StateData.sound_pack) {
        $persisted = [string]$StateData.sound_pack
        if ($persisted -eq "(none)") { return "(none)" }
        if ($script:loadedPacks.ContainsKey($persisted)) { return $persisted }
    }

    # Priority 2: Config project-specific mapping
    if ($script:soundConfig -and $script:soundConfig.PSObject.Properties["projects"]) {
        $projects = $script:soundConfig.projects
        if ($projects.PSObject.Properties[$ProjectName]) {
            $projPack = $projects.PSObject.Properties[$ProjectName].Value
            if ($projPack -and $script:loadedPacks.ContainsKey($projPack)) { return $projPack }
        }
    }

    # Priority 3: Config default (supports "random")
    if ($script:soundConfig -and $script:soundConfig.PSObject.Properties["default"]) {
        $defaultPack = [string]$script:soundConfig.default
        if ($defaultPack -eq "random" -and $script:loadedPacks.Count -gt 0) {
            $packNames = @($script:loadedPacks.Keys)
            return $packNames[$script:rng.Next(0, $packNames.Count)]
        }
        if ($defaultPack -and $script:loadedPacks.ContainsKey($defaultPack)) { return $defaultPack }
    }

    # Priority 4: -SoundPack command-line parameter
    if ($SoundPack -and $script:loadedPacks.ContainsKey($SoundPack)) { return $SoundPack }

    # Priority 5: If exactly one pack loaded, use it
    if ($script:loadedPacks.Count -eq 1) { return @($script:loadedPacks.Keys)[0] }

    return $null
}

function Set-SessionSoundPack {
    param([string]$SessionId, [string]$PackName)
    if (-not $script:sessions.ContainsKey($SessionId)) { return }
    $script:sessions[$SessionId].SoundPack = $PackName
    $entry = $script:sessions[$SessionId]
    $entry.NotifyIcon.Text = Get-TooltipText $entry.Data $entry.DesktopIndex $PackName
    Write-Host "Set sound pack '$PackName' for $SessionId ($($entry.Data.project))"

    # Persist to state file so assignment survives monitor restart
    $stateFile = Join-Path $script:trayDir "$SessionId.json"
    if (Test-Path $stateFile) {
        try {
            $json = Get-Content -Path $stateFile -Raw -ErrorAction Stop
            $data = $json | ConvertFrom-Json
            $data | Add-Member -NotePropertyName "sound_pack" -NotePropertyValue $PackName -Force
            $data | ConvertTo-Json -Compress | ForEach-Object { [IO.File]::WriteAllText($stateFile, $_, (New-Object System.Text.UTF8Encoding $false)) }
        } catch {
            Write-Host "Failed to persist sound pack: $_"
        }
    }
}

function Get-NextSound {
    param([string]$PackName, [string]$EventName)

    if (-not $script:loadedPacks.ContainsKey($PackName)) { return $null }
    $packData = $script:loadedPacks[$PackName]
    if (-not $packData.ContainsKey($EventName)) { return $null }
    $allFiles = $packData[$EventName]
    if ($allFiles.Count -eq 0) { return $null }

    $bagKey = "$PackName|$EventName"

    # Refill bag if empty (Fisher-Yates shuffle)
    if (-not $script:shuffleBags.ContainsKey($bagKey) -or $script:shuffleBags[$bagKey].Count -eq 0) {
        $shuffled = [System.Collections.Generic.List[string]]::new([string[]]$allFiles)
        for ($i = $shuffled.Count - 1; $i -gt 0; $i--) {
            $j = $script:rng.Next(0, $i + 1)
            $tmp = $shuffled[$i]; $shuffled[$i] = $shuffled[$j]; $shuffled[$j] = $tmp
        }
        # Prevent consecutive repeat across bag refills
        if ($script:lastPlayed.ContainsKey($bagKey) -and $shuffled.Count -gt 1) {
            $lastFile = $script:lastPlayed[$bagKey]
            if ($shuffled[$shuffled.Count - 1] -eq $lastFile) {
                $swapIdx = $script:rng.Next(0, $shuffled.Count - 1)
                $tmp = $shuffled[$shuffled.Count - 1]
                $shuffled[$shuffled.Count - 1] = $shuffled[$swapIdx]
                $shuffled[$swapIdx] = $tmp
            }
        }
        $script:shuffleBags[$bagKey] = $shuffled
    }

    $bag = $script:shuffleBags[$bagKey]
    $idx = $bag.Count - 1
    $file = $bag[$idx]
    $bag.RemoveAt($idx)
    $script:lastPlayed[$bagKey] = $file
    return $file
}

function Play-EventSound {
    param(
        [string]$EventName,
        [string]$SessionId
    )
    if ($Silent -or $script:loadedPacks.Count -eq 0) { return }
    if ($script:bootstrapping) { return }

    # Resolve pack for this session
    if (-not $script:sessions.ContainsKey($SessionId)) { return }
    $sessionPack = $script:sessions[$SessionId].SoundPack
    if (-not $sessionPack -or $sessionPack -eq "(none)") { return }
    if (-not $script:loadedPacks.ContainsKey($sessionPack)) { return }

    # No same-desktop suppression for sounds — always play when events need attention

    # Per-session cooldown
    $entry = $script:sessions[$SessionId]
    $elapsed = ([DateTime]::UtcNow - $entry.LastSoundTime).TotalMilliseconds
    if ($elapsed -lt $SoundCooldownMs) { return }

    # Cross-session combo: escalate to "combo" event if another sound played recently
    $resolvedEvent = $EventName
    $globalElapsed = ([DateTime]::UtcNow - $script:lastGlobalSoundTime).TotalMilliseconds
    if ($globalElapsed -lt $SoundComboMs -and $globalElapsed -gt 0) {
        $packData = $script:loadedPacks[$sessionPack]
        if ($packData.ContainsKey("combo")) { $resolvedEvent = "combo" }
    }

    $soundFile = Get-NextSound -PackName $sessionPack -EventName $resolvedEvent
    # Fall back to original event if combo has no files
    if (-not $soundFile -and $resolvedEvent -ne $EventName) {
        $soundFile = Get-NextSound -PackName $sessionPack -EventName $EventName
    }
    if (-not $soundFile) { return }

    try {
        $script:soundPlayer.SoundLocation = $soundFile
        $script:soundPlayer.Play()
        $fileName = Split-Path $soundFile -Leaf
        if ($resolvedEvent -ne $EventName) {
            Write-Host "Sound: $SessionId [$sessionPack/$EventName->$resolvedEvent] $fileName"
        } else {
            Write-Host "Sound: $SessionId [$sessionPack/$EventName] $fileName"
        }
    } catch {
        Write-Host "Sound error: $_"
    }

    $script:lastGlobalSoundTime = [DateTime]::UtcNow
    $script:sessions[$SessionId].LastSoundTime = [DateTime]::UtcNow
}

# ============================================================
# Session tracking
# ============================================================
$script:sessions = @{}
$script:lastKnownDesktop = -1

function Resolve-StatusColor {
    # Map virtual statuses to color keys
    param([string]$Status)
    switch ($Status) {
        "start" { return "busy" }     # red — session just opened, assume working until Stop says otherwise
        "end"   { return "unknown" }  # gray — closing
        default { return $Status }
    }
}

function Get-StatusIcon {
    param([string]$Status, [int]$AgeSec = 0)
    $mapped = Resolve-StatusColor $Status
    $factor = Get-AgingTier $AgeSec
    return Get-AgedIcon $mapped $factor
}

# Cache: claude_pid -> @{ Pid; Handle } for terminal window (stable for session lifetime)
$script:terminalPidCache = @{}

# Resolve which virtual desktop a claude_pid lives on.
# Walks process tree up to terminal window, caches the terminal PID.
# Returns desktop index or -1 if not found.
function Resolve-DesktopFromPid {
    param([int]$ClaudePid)
    if (-not $script:hasVirtualDesktop -or $ClaudePid -le 0) { return -1 }
    try {
        # Check cache first - terminal PID is stable for session lifetime
        $cached = $script:terminalPidCache[$ClaudePid]
        if ($cached) {
            $proc = Get-Process -Id $cached.Pid -ErrorAction SilentlyContinue
            if ($proc -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
                # Refresh handle in case window was recreated
                $cached.Handle = $proc.MainWindowHandle
                $idx = Get-DesktopFromWindow $proc.MainWindowHandle | Get-DesktopIndex
                return $idx
            }
            # Terminal died or lost window - clear cache to re-walk
            $script:terminalPidCache.Remove($ClaudePid)
        }

        # Walk up from claude_pid to find terminal window
        $current = $ClaudePid
        for ($i = 0; $i -lt 15; $i++) {
            $proc = Get-Process -Id $current -ErrorAction SilentlyContinue
            if (-not $proc) { break }
            if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
                $script:terminalPidCache[$ClaudePid] = @{ Pid = $current; Handle = $proc.MainWindowHandle }
                $idx = Get-DesktopFromWindow $proc.MainWindowHandle | Get-DesktopIndex
                Write-Host "Resolved claude=$ClaudePid -> terminal=$($proc.ProcessName)($current) desktop=$idx"
                return $idx
            }
            $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
            if (-not $wmi) { break }
            $parent = $wmi.ParentProcessId
            if (-not $parent -or $parent -eq $current -or $parent -eq 0) { break }
            $current = $parent
        }
    } catch {}
    return -1
}

function Focus-TerminalWindow {
    param([string]$SessionId)
    if (-not $script:sessions.ContainsKey($SessionId)) { return }
    $data = $script:sessions[$SessionId].Data
    if (-not $data.PSObject.Properties["claude_pid"] -or $null -eq $data.claude_pid) { return }
    $cached = $script:terminalPidCache[[int]$data.claude_pid]
    if ($cached -and $cached.Handle -ne [IntPtr]::Zero) {
        try { [WinApi]::SetForegroundWindow($cached.Handle) | Out-Null } catch {}
    }
}

function Format-AgeDuration {
    param([int]$Seconds)
    if ($Seconds -lt 60)  { return "${Seconds}s" }
    if ($Seconds -lt 3600) { return "$([int]($Seconds / 60))m" }
    return "$([int]($Seconds / 3600))h$([int](($Seconds % 3600) / 60))m"
}

function Get-TooltipText {
    param([PSCustomObject]$Data, [int]$DesktopIdx, [string]$PackName, [int]$AgeSec = 0)
    $project = $Data.project
    $status = $Data.status
    $age = Format-AgeDuration $AgeSec
    $tip = "$project [$status $age]"
    if ($DesktopIdx -ge 0) { $tip += " (d$DesktopIdx)" }
    if ($PackName -and $PackName -ne "(none)") { $tip += " ~$PackName" }
    if ($tip.Length -gt 63) { $tip = $tip.Substring(0, 60) + "..." }
    return $tip
}

function Set-SessionDesktop {
    param([string]$SessionId, [int]$DesktopIdx)
    if (-not $script:sessions.ContainsKey($SessionId)) { return }
    $script:sessions[$SessionId].DesktopIndex = $DesktopIdx
    $entry = $script:sessions[$SessionId]
    $entry.NotifyIcon.Text = Get-TooltipText $entry.Data $DesktopIdx $entry.SoundPack
    Write-Host "Set desktop $DesktopIdx for $SessionId ($($entry.Data.project))"

    # Persist to state file so assignments survive restarts
    $stateFile = Join-Path $script:trayDir "$SessionId.json"
    if (Test-Path $stateFile) {
        try {
            $json = Get-Content -Path $stateFile -Raw -ErrorAction Stop
            $data = $json | ConvertFrom-Json
            $data | Add-Member -NotePropertyName "desktop_index" -NotePropertyValue $DesktopIdx -Force
            $data | ConvertTo-Json -Compress | ForEach-Object { [IO.File]::WriteAllText($stateFile, $_, (New-Object System.Text.UTF8Encoding $false)) }
        } catch {
            Write-Host "Failed to persist desktop: $_"
        }
    }
}

function Switch-ToSessionDesktop {
    param([string]$SessionId)
    if (-not $script:sessions.ContainsKey($SessionId)) { return }
    $idx = $script:sessions[$SessionId].DesktopIndex
    if ($idx -ge 0 -and $script:hasVirtualDesktop) {
        try { Switch-Desktop $idx } catch { Write-Host "Switch failed: $_" }
    }
    # Focus the terminal window (works even without PSVirtualDesktop on single-desktop setups)
    Focus-TerminalWindow $SessionId
}

function Show-SessionToast {
    param(
        [string]$SessionId,
        [string]$NewStatus,
        [PSCustomObject]$StateData
    )
    if ($NoToast) { return }
    if ($ToastEvents -notcontains $NewStatus) { return }

    # Suppress if session is on the current desktop (user can already see it)
    if ($script:hasVirtualDesktop -and $script:sessions.ContainsKey($SessionId)) {
        $deskIdx = $script:sessions[$SessionId].DesktopIndex
        if ($deskIdx -ge 0 -and $deskIdx -eq $script:lastKnownDesktop) { return }
    }

    $project = $StateData.project
    $title = switch ($NewStatus) {
        "idle"      { "$project - Finished" }
        "attention" { "$project - Needs Attention" }
        default     { "$project - $NewStatus" }
    }

    # Body: use last_message from state data, fall back to cached last message,
    # fall back to generic text
    $body = $StateData.last_message
    if (-not $body -and $script:sessions.ContainsKey($SessionId)) {
        $body = $script:sessions[$SessionId].LastMessage
    }
    if (-not $body) {
        $body = switch ($NewStatus) {
            "idle"      { "Waiting for input" }
            "attention" {
                if ($StateData.notification_type) { $StateData.notification_type }
                else { "Needs your attention" }
            }
            default     { "" }
        }
    }

    if (-not $script:sessions.ContainsKey($SessionId)) { return }
    $ni = $script:sessions[$SessionId].NotifyIcon

    # Suppress toast system sound when sound packs are loaded
    $tipIcon = if ($script:loadedPacks.Count -gt 0) {
        [System.Windows.Forms.ToolTipIcon]::None
    } else {
        switch ($NewStatus) {
            "idle"      { [System.Windows.Forms.ToolTipIcon]::Info }
            "attention" { [System.Windows.Forms.ToolTipIcon]::Warning }
            default     { [System.Windows.Forms.ToolTipIcon]::None }
        }
    }
    $ni.ShowBalloonTip(5000, $title, $body, $tipIcon)
    Write-Host "Toast: $SessionId [$NewStatus] $title - $body"
}

function Remove-SessionIcon {
    param([string]$SessionId)
    if ($script:sessions.ContainsKey($SessionId)) {
        $entry = $script:sessions[$SessionId]
        if ($entry.NotifyIcon) {
            $entry.NotifyIcon.Visible = $false
            if ($entry.NotifyIcon.ContextMenuStrip) {
                $entry.NotifyIcon.ContextMenuStrip.Dispose()
            }
            $entry.NotifyIcon.Dispose()
        }
        $script:sessions.Remove($SessionId)
        Write-Host "Removed $SessionId (tracking $($script:sessions.Count) sessions)"
    }
}

function Update-SessionIcon {
    param([string]$SessionId, [PSCustomObject]$StateData)

    $status = $StateData.status

    # Auto-detect desktop from claude_pid (walks process tree to terminal window)
    $autoDesktop = -1
    if ($StateData.PSObject.Properties["claude_pid"] -and $null -ne $StateData.claude_pid) {
        $autoDesktop = Resolve-DesktopFromPid ([int]$StateData.claude_pid)
    }

    if ($Dry) {
        # Dry mode: log only, no UI objects
        if ($script:sessions.ContainsKey($SessionId)) {
            $oldStatus = $script:sessions[$SessionId].Data.status
            $script:sessions[$SessionId].Data = $StateData
            $script:sessions[$SessionId].LastUpdate = [DateTime]::UtcNow
            if ($status -ne $oldStatus) {
                Write-Host "[DRY] Update: $SessionId $($StateData.project) [$oldStatus -> $status]"
            }
        } else {
            if ($status -eq "end") {
                Write-Host "[DRY] Skip ended: $SessionId $($StateData.project)"
                return
            }
            $script:sessions[$SessionId] = [PSCustomObject]@{
                NotifyIcon = $null; Data = $StateData; DesktopIndex = $autoDesktop
                LastUpdate = [DateTime]::UtcNow; LastFileWrite = [DateTime]::MinValue
                LastMessage = $StateData.last_message; LastSoundTime = [DateTime]::MinValue
                RemoveAfter = $null; SoundPack = $null; Dismissed = $false
                StatusSince = [DateTime]::UtcNow; LastSeenAt = [DateTime]::UtcNow; LastAgingFactor = 1.0
            }
            Write-Host "[DRY] New: $SessionId $($StateData.project) [$status] [tracking $($script:sessions.Count)]"
        }
        return
    }

    if ($script:sessions.ContainsKey($SessionId)) {
        # Update existing
        $entry = $script:sessions[$SessionId]
        $oldStatus = $entry.Data.status

        # Preserve last_message from UserPromptSubmit for Stop event toasts
        if ($StateData.last_message) {
            $entry.LastMessage = $StateData.last_message
        }

        $entry.Data = $StateData
        $entry.LastUpdate = [DateTime]::UtcNow
        # Cancel grace-period removal if session resumed (SessionEnd → SessionStart race)
        if ($status -ne "end" -and $null -ne $entry.RemoveAfter) {
            Write-Host "Resumed: $SessionId (cancelled grace removal)"
            $entry.RemoveAfter = $null
        }
        # Reset status clock on status change (for tooltip duration)
        if ($status -ne $oldStatus) {
            $entry.StatusSince = [DateTime]::UtcNow
        }
        # Icon color uses attention clock (LastSeenAt), tooltip uses status clock (StatusSince)
        $seenAge = [int]([DateTime]::UtcNow - $entry.LastSeenAt).TotalSeconds
        $entry.NotifyIcon.Icon = Get-StatusIcon $status $seenAge
        $statusAge = [int]([DateTime]::UtcNow - $entry.StatusSince).TotalSeconds
        # Auto-update desktop if detected (overrides stale manual assignment)
        if ($autoDesktop -ge 0) {
            $entry.DesktopIndex = $autoDesktop
        }
        $entry.NotifyIcon.Text = Get-TooltipText $StateData $entry.DesktopIndex $entry.SoundPack $statusAge

        # Un-dismiss only when session needs you: you submitted (busy), Claude needs input (attention),
        # or Claude is blocked on tool approval (permission)
        if ($entry.Dismissed -and $status -ne $oldStatus -and ($status -eq "busy" -or $status -eq "attention" -or $status -eq "permission")) {
            $entry.NotifyIcon.Visible = $true
            $entry.Dismissed = $false
            Write-Host "Restored: $SessionId (status changed to $status)"
        }

        # Fire toast and transition sounds on status CHANGE only
        if ($status -ne $oldStatus) {
            Show-SessionToast -SessionId $SessionId -NewStatus $status -StateData $StateData
            switch ($status) {
                "busy" { Play-EventSound -EventName "getting_to_work" -SessionId $SessionId }
                "idle" { Play-EventSound -EventName "finished" -SessionId $SessionId }
                "end"  {
                    Play-EventSound -EventName "session_end" -SessionId $SessionId
                    $entry.RemoveAfter = [DateTime]::UtcNow.AddSeconds(5)
                }
            }
        }

        # Needs-you sounds fire on EVERY file rewrite (not just transitions)
        # because consecutive permission prompts both write status=attention
        $ntype = $null
        if ($StateData.PSObject.Properties["notification_type"]) { $ntype = $StateData.notification_type }
        if ($ntype -eq "permission_prompt" -or $ntype -eq "elicitation_dialog") {
            Play-EventSound -EventName "needs_you" -SessionId $SessionId
        } elseif ($ntype -eq "idle_prompt") {
            Play-EventSound -EventName "forgotten" -SessionId $SessionId
        }
    } else {
        # Skip creating icons for sessions that are already ended
        # (e.g., monitor restarted after session ended, or "end" file arrived late)
        if ($status -eq "end") {
            $f = Join-Path $script:trayDir "$SessionId.json"
            if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
            return
        }

        # Resolve desktop and sound pack BEFORE creating UI objects
        # (these are needed by context menu items below)
        $initialDesktop = $autoDesktop
        if ($initialDesktop -lt 0 -and $StateData.PSObject.Properties["desktop_index"] -and $null -ne $StateData.desktop_index) {
            $initialDesktop = [int]$StateData.desktop_index
        }
        $initialPack = Resolve-InitialPack -ProjectName $StateData.project -StateData $StateData

        # Persist initial pack assignment so it survives monitor restarts
        if ($initialPack -and $initialPack -ne "(none)") {
            $stateFile = Join-Path $script:trayDir "$SessionId.json"
            if (Test-Path $stateFile) {
                try {
                    $stateJson = Get-Content -Path $stateFile -Raw -ErrorAction Stop
                    $stateObj = $stateJson | ConvertFrom-Json
                    if (-not $stateObj.PSObject.Properties["sound_pack"] -or $stateObj.sound_pack -ne $initialPack) {
                        $stateObj | Add-Member -NotePropertyName "sound_pack" -NotePropertyValue $initialPack -Force
                        $stateObj | ConvertTo-Json -Compress | ForEach-Object { [IO.File]::WriteAllText($stateFile, $_, (New-Object System.Text.UTF8Encoding $false)) }
                    }
                } catch {}
            }
        }

        # Create new NotifyIcon
        $ni = New-Object System.Windows.Forms.NotifyIcon
        $ni.Icon = Get-StatusIcon $status
        $ni.Visible = $true
        $ni.Tag = $SessionId

        # Context menu
        $cms = New-Object System.Windows.Forms.ContextMenuStrip

        $switchItem = New-Object System.Windows.Forms.ToolStripMenuItem("Switch to Desktop")
        $switchItem.Tag = $SessionId

        $assignItem = New-Object System.Windows.Forms.ToolStripMenuItem("Assign to This Desktop")
        $assignItem.Tag = $SessionId

        $desktopMenu = New-Object System.Windows.Forms.ToolStripMenuItem("Set Desktop")
        if ($script:hasVirtualDesktop) {
            try {
                $count = Get-DesktopCount
                for ($i = 0; $i -lt $count; $i++) {
                    $dItem = New-Object System.Windows.Forms.ToolStripMenuItem("Desktop $i")
                    $dItem.Tag = "$SessionId|$i"
                    if ($i -eq $initialDesktop) { $dItem.Checked = $true }
                    $dItem.add_Click({
                        param($sender, $e)
                        $parts = $sender.Tag -split '\|'
                        Set-SessionDesktop $parts[0] ([int]$parts[1])
                    })
                    $desktopMenu.DropDownItems.Add($dItem) | Out-Null
                }
            } catch {}
        }

        # Sound Pack submenu (lists all loaded packs + "(None)" option)
        $soundPackMenu = New-Object System.Windows.Forms.ToolStripMenuItem("Sound Pack")
        if ($script:loadedPacks.Count -gt 0) {
            $noneItem = New-Object System.Windows.Forms.ToolStripMenuItem("(None)")
            $noneItem.Tag = "$SessionId|(none)"
            $noneItem.add_Click({
                param($sender, $e)
                $parts = $sender.Tag -split '\|', 2
                Set-SessionSoundPack $parts[0] $parts[1]
            })
            $soundPackMenu.DropDownItems.Add($noneItem) | Out-Null
            $soundPackMenu.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
            foreach ($pn in ($script:loadedPacks.Keys | Sort-Object)) {
                $pItem = New-Object System.Windows.Forms.ToolStripMenuItem($pn)
                $pItem.Tag = "$SessionId|$pn"
                if ($pn -eq $initialPack) { $pItem.Checked = $true }
                $pItem.add_Click({
                    param($sender, $e)
                    $parts = $sender.Tag -split '\|', 2
                    Set-SessionSoundPack $parts[0] $parts[1]
                })
                $soundPackMenu.DropDownItems.Add($pItem) | Out-Null
            }
        }

        # Manage submenu
        $manageMenu = New-Object System.Windows.Forms.ToolStripMenuItem("Manage")
        $clearThisItem = New-Object System.Windows.Forms.ToolStripMenuItem("Clear This Session")
        $clearThisItem.Tag = $SessionId
        $clearThisItem.add_Click({
            param($sender, $e)
            $sid = $sender.Tag
            Remove-SessionIcon $sid
            $f = Join-Path $script:trayDir "$sid.json"
            if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
            $p = Join-Path $script:trayDir ".pid-$sid"
            if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
        })
        $clearAllItem = New-Object System.Windows.Forms.ToolStripMenuItem("Clear All Sessions")
        $clearAllItem.add_Click({
            param($sender, $e)
            foreach ($sid in @($script:sessions.Keys)) { Remove-SessionIcon $sid }
            Get-ChildItem -Path $script:trayDir -Filter "*.json" -ErrorAction SilentlyContinue |
                Remove-Item -Force -ErrorAction SilentlyContinue
            Get-ChildItem -Path $script:trayDir -Filter ".pid-*" -ErrorAction SilentlyContinue |
                Remove-Item -Force -ErrorAction SilentlyContinue
            Write-Host "Cleared all sessions and state files"
        })
        $dumpStateItem = New-Object System.Windows.Forms.ToolStripMenuItem("Dump State")
        $dumpStateItem.add_Click({
            param($sender, $e)
            $logFile = Join-Path $script:trayDir "hook.log"
            $noUtf8Bom = New-Object System.Text.UTF8Encoding $false
            $ts = [DateTime]::UtcNow.ToString("HH:mm:ss.fff")
            $lines = @("$ts [DUMP] ===== State Dump ($($script:sessions.Count) sessions) =====")
            foreach ($sid in @($script:sessions.Keys)) {
                $entry = $script:sessions[$sid]
                $d = $entry.Data
                $age = [int]([DateTime]::UtcNow - $entry.LastUpdate).TotalSeconds
                $fileAge = [int]([DateTime]::UtcNow - $entry.LastFileWrite).TotalSeconds
                $statusAge = if ($entry.PSObject.Properties["StatusSince"]) { [int]([DateTime]::UtcNow - $entry.StatusSince).TotalSeconds } else { -1 }
                $seenAge = if ($entry.PSObject.Properties["LastSeenAt"]) { [int]([DateTime]::UtcNow - $entry.LastSeenAt).TotalSeconds } else { -1 }
                $agingFactor = if ($entry.PSObject.Properties["LastAgingFactor"]) { $entry.LastAgingFactor } else { "?" }
                $lines += "$ts [DUMP] $($sid.Substring(0,8)) project=$($d.project) status=$($d.status) hook=$($d.hook_event) desktop=$($entry.DesktopIndex) pack=$($entry.SoundPack) dismissed=$($entry.Dismissed) age=${age}s file_age=${fileAge}s statusAge=${statusAge}s seenAge=${seenAge}s aging=$agingFactor pid=$($d.claude_pid)"
                # Also read the actual state file for comparison
                $sf = Join-Path $script:trayDir "$sid.json"
                if (Test-Path $sf) {
                    try {
                        $raw = [IO.File]::ReadAllText($sf, $noUtf8Bom)
                        $fd = $raw | ConvertFrom-Json
                        if ($fd.status -ne $d.status) {
                            $lines += "$ts [DUMP] $($sid.Substring(0,8))   FILE MISMATCH: file.status=$($fd.status) vs memory.status=$($d.status)"
                        }
                    } catch {
                        $lines += "$ts [DUMP] $($sid.Substring(0,8))   FILE READ ERROR: $_"
                    }
                } else {
                    $lines += "$ts [DUMP] $($sid.Substring(0,8))   NO STATE FILE"
                }
            }
            $lines += "$ts [DUMP] ===== End Dump ====="
            $dump = ($lines -join "`n") + "`n"
            [IO.File]::AppendAllText($logFile, $dump, $noUtf8Bom)
            Write-Host "State dumped to hook.log ($($script:sessions.Count) sessions)"
        })
        $manageMenu.DropDownItems.Add($clearThisItem) | Out-Null
        $manageMenu.DropDownItems.Add($dumpStateItem) | Out-Null
        $manageMenu.DropDownItems.Add($clearAllItem) | Out-Null

        $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem("Exit Monitor")

        $cms.Items.Add($switchItem) | Out-Null
        $cms.Items.Add($assignItem) | Out-Null
        $cms.Items.Add($desktopMenu) | Out-Null
        $cms.Items.Add($soundPackMenu) | Out-Null
        $cms.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
        $cms.Items.Add($manageMenu) | Out-Null
        $cms.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
        $cms.Items.Add($exitItem) | Out-Null

        $switchItem.add_Click({ param($sender, $e); Switch-ToSessionDesktop $sender.Tag })
        $assignItem.add_Click({
            param($sender, $e)
            if ($script:lastKnownDesktop -ge 0) { Set-SessionDesktop $sender.Tag $script:lastKnownDesktop }
        })
        $exitItem.add_Click({ Stop-TrayMonitor })

        $ni.ContextMenuStrip = $cms
        $ni.add_MouseClick({
            param($sender, $e)
            if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
                # Reset attention clock on click — visual cue that you've checked this session
                $sid = $sender.Tag
                if ($script:sessions.ContainsKey($sid)) {
                    $entry = $script:sessions[$sid]
                    $entry.LastSeenAt = [DateTime]::UtcNow
                    $entry.LastAgingFactor = 1.0
                    $mapped = Resolve-StatusColor $entry.Data.status
                    $entry.NotifyIcon.Icon = Get-AgedIcon $mapped 1.0
                }
                Switch-ToSessionDesktop $sid
            }
        })
        $ni.add_BalloonTipClicked({
            param($sender, $e)
            $sid = $sender.Tag
            if ($script:sessions.ContainsKey($sid)) {
                $entry = $script:sessions[$sid]
                $entry.LastSeenAt = [DateTime]::UtcNow
                $entry.LastAgingFactor = 1.0
                $mapped = Resolve-StatusColor $entry.Data.status
                $entry.NotifyIcon.Icon = Get-AgedIcon $mapped 1.0
            }
            Switch-ToSessionDesktop $sid
        })

        $entry = [PSCustomObject]@{
            NotifyIcon    = $ni
            Data          = $StateData
            DesktopIndex  = $initialDesktop
            LastUpdate    = [DateTime]::UtcNow
            LastFileWrite = [DateTime]::MinValue
            LastMessage   = $StateData.last_message
            LastSoundTime = [DateTime]::MinValue
            RemoveAfter      = $null
            SoundPack        = $initialPack
            Dismissed        = $false
            StatusSince      = [DateTime]::UtcNow
            LastSeenAt       = [DateTime]::UtcNow
            LastAgingFactor  = 1.0
        }
        $script:sessions[$SessionId] = $entry
        $ni.Text = Get-TooltipText $StateData $initialDesktop $initialPack
        $packInfo = if ($initialPack) { " pack=$initialPack" } else { "" }
        Write-Host "New: $SessionId ($($StateData.project) [$status] desktop=$initialDesktop$packInfo) [tracking $($script:sessions.Count) sessions]"

        # Toast and sound for new sessions
        # (suppressed during bootstrap to avoid flood on monitor start)
        if (-not $script:bootstrapping) {
            Show-SessionToast -SessionId $SessionId -NewStatus $status -StateData $StateData
            if ($status -eq "start") {
                Play-EventSound -EventName "session_start" -SessionId $SessionId
            } elseif ($status -eq "busy") {
                Play-EventSound -EventName "getting_to_work" -SessionId $SessionId
            }
            # Check for needs-you sounds on new sessions (e.g., session appeared in attention state)
            $ntype = $null
            if ($StateData.PSObject.Properties["notification_type"]) { $ntype = $StateData.notification_type }
            if ($ntype -eq "permission_prompt" -or $ntype -eq "elicitation_dialog") {
                Play-EventSound -EventName "needs_you" -SessionId $SessionId
            } elseif ($ntype -eq "idle_prompt") {
                Play-EventSound -EventName "forgotten" -SessionId $SessionId
            }
        }
    }

}

# ============================================================
# Shutdown
# ============================================================
function Stop-TrayMonitor {
    $script:pollTimer.Stop()
    $script:cleanupTimer.Stop()

    foreach ($kv in @($script:sessions.GetEnumerator())) {
        $kv.Value.NotifyIcon.Visible = $false
        if ($kv.Value.NotifyIcon.ContextMenuStrip) {
            $kv.Value.NotifyIcon.ContextMenuStrip.Dispose()
        }
        $kv.Value.NotifyIcon.Dispose()
    }
    $script:sessions.Clear()

    foreach ($ic in $script:agedIconCache.Values) {
        $ic.Icon.Dispose()
        $ic.Bitmap.Dispose()
    }

    $script:soundPlayer.Dispose()

    $script:mutex.ReleaseMutex()
    $script:mutex.Dispose()

    [System.Windows.Forms.Application]::Exit()
}

# ============================================================
# Poll timer - scans directory for changes (replaces FileSystemWatcher)
# ============================================================
$script:pollTimer = New-Object System.Windows.Forms.Timer
$script:pollTimer.Interval = $PollMs

$script:pollTimer.add_Tick({
    # Track current desktop every tick
    if ($script:hasVirtualDesktop) {
        try { $script:lastKnownDesktop = Get-CurrentDesktop | Get-DesktopIndex } catch {}
    }

    # Scan directory for state files
    $currentFiles = @{}
    Get-ChildItem -Path $script:trayDir -Filter "*.json" -ErrorAction SilentlyContinue | ForEach-Object {
        $sid = $_.BaseName
        $currentFiles[$sid] = $true

        # Only process if file is newer than last read
        $entry = $null
        if ($script:sessions.ContainsKey($sid)) {
            $entry = $script:sessions[$sid]
        }
        $lastWrite = $_.LastWriteTimeUtc
        if ($entry -and $lastWrite -le $entry.LastFileWrite) { return }

        try {
            $json = Get-Content -Path $_.FullName -Raw -ErrorAction Stop
            $data = $json | ConvertFrom-Json
            if ($data.session_id) {
                Update-SessionIcon -SessionId $data.session_id -StateData $data
                if ($script:sessions.ContainsKey($data.session_id)) {
                    $script:sessions[$data.session_id].LastFileWrite = $lastWrite
                }
            }
        } catch {}
    }

    # Remove icons for deleted state files
    $removeSids = @()
    foreach ($sid in @($script:sessions.Keys)) {
        if (-not $currentFiles.ContainsKey($sid)) { $removeSids += $sid }
    }
    foreach ($sid in $removeSids) { Remove-SessionIcon $sid }

    # Remove sessions past their grace period (SessionEnd farewell)
    $graceRemove = @()
    foreach ($sid in @($script:sessions.Keys)) {
        $entry = $script:sessions[$sid]
        if ($null -ne $entry.RemoveAfter -and [DateTime]::UtcNow -gt $entry.RemoveAfter) {
            $graceRemove += $sid
        }
    }
    foreach ($sid in $graceRemove) {
        Remove-SessionIcon $sid
        $f = Join-Path $script:trayDir "$sid.json"
        if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
    }

    # Aging: color darkens based on attention clock (LastSeenAt), tooltip shows status clock (StatusSince)
    $now = [DateTime]::UtcNow
    foreach ($sid in @($script:sessions.Keys)) {
        $entry = $script:sessions[$sid]
        if (-not $entry.NotifyIcon -or -not $entry.PSObject.Properties["LastSeenAt"]) { continue }
        # Color aging: time since user last clicked/looked
        $seenAge = [int]($now - $entry.LastSeenAt).TotalSeconds
        $factor = Get-AgingTier $seenAge
        if ($factor -ne $entry.LastAgingFactor) {
            $entry.LastAgingFactor = $factor
            $mapped = Resolve-StatusColor $entry.Data.status
            $entry.NotifyIcon.Icon = Get-AgedIcon $mapped $factor
        }
        # Tooltip: time since last status change (every 5s to avoid churn)
        $statusAge = [int]($now - $entry.StatusSince).TotalSeconds
        if ($statusAge % 5 -lt 2) {
            $entry.NotifyIcon.Text = Get-TooltipText $entry.Data $entry.DesktopIndex $entry.SoundPack $statusAge
        }
    }
})
$script:pollTimer.Start()

# ============================================================
# Stale cleanup timer (every 60 seconds)
# ============================================================
$script:cleanupTimer = New-Object System.Windows.Forms.Timer
$script:cleanupTimer.Interval = 60000

$script:cleanupTimer.add_Tick({
    $now = [DateTime]::UtcNow
    $staleIds = @()
    foreach ($kv in $script:sessions.GetEnumerator()) {
        # Use state file timestamp (survives monitor restarts) with LastUpdate as fallback
        $staleAge = $null
        $d = $kv.Value.Data
        if ($d.PSObject.Properties["timestamp"] -and $d.timestamp) {
            try { $staleAge = $now - [DateTime]::Parse($d.timestamp).ToUniversalTime() } catch {}
        }
        if (-not $staleAge) { $staleAge = $now - $kv.Value.LastUpdate }
        if ($staleAge.TotalMinutes -gt $StaleMinutes) {
            # Keep session alive if its state file still exists on disk
            $f = Join-Path $script:trayDir "$($kv.Key).json"
            if (Test-Path $f) {
                # State file present — session may still be active; skip cleanup
                continue
            }
            $staleIds += $kv.Key
        }
    }
    foreach ($sid in $staleIds) {
        Write-Host "Stale: $sid removed (>${StaleMinutes}m without update)"
        Remove-SessionIcon $sid
        $f = Join-Path $script:trayDir "$sid.json"
        if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
    }
})
$script:cleanupTimer.Start()

# ============================================================
# Initialize sound packs (before bootstrap so they're ready for first events)
# ============================================================
Initialize-SoundPacks

# ============================================================
# Bootstrap: initial scan (suppress toasts and sounds to avoid flood)
# ============================================================
$script:bootstrapping = $true
$bootFiles = @(Get-ChildItem -Path $script:trayDir -Filter "*.json" -ErrorAction SilentlyContinue)
Write-Host "Bootstrap: found $($bootFiles.Count) state files"
foreach ($bf in $bootFiles) {
    try {
        $json = Get-Content -Path $bf.FullName -Raw
        $data = $json | ConvertFrom-Json
        if ($data.session_id) {
            Write-Host "Bootstrap: processing $($data.session_id) ($($data.project) [$($data.status)])"
            Update-SessionIcon -SessionId $data.session_id -StateData $data
            if ($script:sessions.ContainsKey($data.session_id)) {
                $script:sessions[$data.session_id].LastFileWrite = $bf.LastWriteTimeUtc
            }
        }
    } catch {
        Write-Host "Bootstrap ERROR: $($bf.Name): $_"
    }
}
$script:bootstrapping = $false

Write-Host "Claude tray monitor started. Watching: $($script:trayDir) (tracking $($script:sessions.Count) sessions)"

# ============================================================
# Run the WinForms message pump (blocks until Exit)
# ============================================================
try {
    [System.Windows.Forms.Application]::Run()
} finally {
    # Cleanup on any exit path (graceful, Ctrl+C, or process kill)
    # Prevents ghost tray icons from accumulating
    Write-Host "Shutting down - cleaning up $($script:sessions.Count) tray icons"
    foreach ($kv in @($script:sessions.GetEnumerator())) {
        try {
            $kv.Value.NotifyIcon.Visible = $false
            $kv.Value.NotifyIcon.Dispose()
        } catch {}
    }
    $script:soundPlayer.Dispose()
    try { $script:mutex.ReleaseMutex() } catch {}
    try { $script:mutex.Dispose() } catch {}
}
