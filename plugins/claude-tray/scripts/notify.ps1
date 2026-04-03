#Requires -Version 5.1
<#
.SYNOPSIS
    Send context-aware notifications via ntfy.sh, toast, or both.

.DESCRIPTION
    Reads hook JSON from stdin (piped by Claude Code) to build rich
    notifications with project name, event context, and last user message.
    Falls back to -Message parameter if stdin is empty.

    Use -Via to control which notification channels are used:
    - "all"   : try ntfy first, fall back to toast (default)
    - "ntfy"  : ntfy only, no fallback
    - "toast" : Windows toast only, no ntfy

.PARAMETER Message
    Fallback message body if no hook JSON is available on stdin.

.PARAMETER Title
    The notification title. Defaults to "Claude Code".

.PARAMETER Via
    Notification channel: "all" (default), "ntfy", or "toast".

.PARAMETER NtfyTopic
    The ntfy.sh topic to publish to. Only used when Via is "all" or "ntfy".

.EXAMPLE
    # Toast only (no ntfy):
    .\notify.ps1 -Via toast

    # ntfy only:
    .\notify.ps1 -Via ntfy -NtfyTopic "my-topic"

    # Both (ntfy first, toast fallback — default):
    .\notify.ps1 -NtfyTopic "my-topic"

    # Manual fallback (no stdin):
    .\notify.ps1 -Via toast -Message "Task completed"

.NOTES
    Setup:
    1. Copy this file to ~/.claude/notify.ps1
    2. For toast: Install-Module -Name BurntToast -Scope CurrentUser
    3. For ntfy: Update NtfyTopic default or pass via settings.json hook command
    4. Requires jq on PATH for transcript parsing (same dep as context-bar.sh)

    Hook JSON fields used:
    - hook_event_name: "Stop" or "Notification"
    - cwd: project directory (for title)
    - message: actual notification text (Notification hooks)
    - notification_type: "permission_prompt", "idle_prompt", etc.
    - transcript_path: path to conversation JSONL (for last user message)
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Message = "",

    [Parameter(Position = 1)]
    [string]$Title = "Claude Code",

    [Parameter()]
    [ValidateSet("all", "ntfy", "toast")]
    [string]$Via = "all",

    [Parameter()]
    [string]$NtfyTopic = "your-secret-claude-topic"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Read hook JSON from stdin ---
$hookData = $null
try {
    if (-not [Console]::IsInputRedirected) {
        # No stdin — use parameter fallback
    } else {
        $stdinRaw = [Console]::In.ReadToEnd()
        if ($stdinRaw.Trim().Length -gt 0) {
            $hookData = $stdinRaw | ConvertFrom-Json
        }
    }
} catch {
    Write-Verbose "Failed to parse stdin JSON: $($_.Exception.Message)"
}

# --- Extract context from hook data ---
if ($hookData) {
    # Project name from cwd
    $project = ""
    if ($hookData.cwd) {
        $project = Split-Path -Leaf $hookData.cwd
    }

    # Title: "Claude Code (project-name)"
    if ($project) {
        $Title = "Claude Code ($project)"
    }

    # Message: use hook's actual message or build from event type
    $eventName = $hookData.hook_event_name
    if ($eventName -eq "Notification" -and $hookData.message) {
        $Message = $hookData.message
    } elseif ($eventName -eq "Stop") {
        $Message = "Finished - waiting for input"
    }

    # Last user message from transcript
    $lastCmd = ""
    if ($hookData.transcript_path -and (Test-Path $hookData.transcript_path)) {
        try {
            $jqFilter = @'
[.[] | select(.type == "user") | select(.message.content | type == "string" or (type == "array" and any(.[]; .type == "text")))] | reverse | map(.message.content | if type == "string" then . else [.[] | select(.type == "text") | .text] | join(" ") end | gsub("\n"; " ") | gsub("  +"; " ")) | map(select(startswith("[Request interrupted") or startswith("[Request cancelled") or . == "" | not)) | first // ""
'@
            # Read only last 200 lines to avoid O(n) growth as transcript grows
            $tail = Get-Content -Path $hookData.transcript_path -Tail 200 -ErrorAction Stop
            $lastCmd = $tail | & jq -rs $jqFilter 2>$null
            if ($lastCmd) {
                $lastCmd = $lastCmd.Trim().Trim('"')
                # Truncate long messages
                if ($lastCmd.Length -gt 80) {
                    $lastCmd = $lastCmd.Substring(0, 77) + "..."
                }
            }
        } catch {
            Write-Verbose "Failed to read transcript: $($_.Exception.Message)"
        }
    }

    # Append last command to message
    if ($lastCmd) {
        $Message = "$Message`n> $lastCmd"
    }
}

# --- Bail if we still have no message ---
if (-not $Message) {
    Write-Verbose "No message to send (no stdin and no -Message parameter)"
    exit 0
}

# --- Notification functions ---

function Send-NtfyNotification {
    param([string]$Topic, [string]$Title, [string]$Body)

    $uri = "https://ntfy.sh/$Topic"
    $headers = @{ Title = $Title }
    Invoke-RestMethod -Method Post -Uri $uri -Body $Body -Headers $headers -TimeoutSec 10 | Out-Null
}

function Send-ToastNotification {
    param([string]$Title, [string]$Body)

    try {
        Import-Module BurntToast -ErrorAction Stop
    } catch {
        Write-Warning "BurntToast module not installed. Install with: Install-Module -Name BurntToast -Scope CurrentUser"
        [System.Media.SystemSounds]::Asterisk.Play()
        return
    }
    New-BurntToastNotification -Text $Title, $Body -Silent
}

function Send-Notification {
    param([string]$Title, [string]$Message, [string]$Topic, [string]$Channel)

    if ($Channel -eq "toast") {
        # Toast only
        try {
            Send-ToastNotification -Title $Title -Body $Message | Out-Null
            Write-Verbose "Notification sent via toast"
        }
        catch {
            Write-Warning "Toast notification failed: $($_.Exception.Message)"
            Write-Host "[$Title] $Message"
        }
        return
    }

    if ($Channel -eq "ntfy") {
        # Ntfy only
        try {
            Send-NtfyNotification -Topic $Topic -Title $Title -Body $Message | Out-Null
            Write-Verbose "Notification sent via ntfy.sh"
        }
        catch {
            Write-Warning "ntfy.sh failed: $($_.Exception.Message)"
            Write-Host "[$Title] $Message"
        }
        return
    }

    # "all": try ntfy first, fall back to toast
    try {
        Send-NtfyNotification -Topic $Topic -Title $Title -Body $Message | Out-Null
        Write-Verbose "Notification sent via ntfy.sh"
        return
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            try {
                $statusCode = [int]$_.Exception.Response.StatusCode
            } catch {
                $statusCode = $_.Exception.Response.StatusCode.value__
            }
        }

        $reason = if ($statusCode -eq 429) { "rate limited (429)" }
                  elseif ($statusCode) { "HTTP $statusCode" }
                  else { $_.Exception.Message }

        Write-Verbose "ntfy.sh failed: $reason - falling back to toast"
    }

    try {
        Send-ToastNotification -Title $Title -Body $Message | Out-Null
        Write-Verbose "Notification sent via toast"
    }
    catch {
        Write-Warning "Toast notification failed: $($_.Exception.Message)"
        Write-Host "[$Title] $Message"
    }
}

# Main execution
Send-Notification -Title $Title -Message $Message -Topic $NtfyTopic -Channel $Via
