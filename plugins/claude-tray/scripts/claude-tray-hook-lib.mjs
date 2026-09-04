// claude-tray-hook-lib.mjs — Pure functions for tray hook state derivation.
// No side effects, no I/O. All testable in isolation.

import { basename } from 'node:path';

const STATUS_MAP = {
  SessionStart: 'start',
  UserPromptSubmit: 'busy',
  PreToolUse: 'busy',
  PreCompact: 'compact',
  Stop: 'idle',
  Notification: 'attention',
  PermissionRequest: 'permission',
  SessionEnd: 'end',
};

/**
 * Map hook event name (+ optional context fields) to tray status.
 * Returns null for unknown events (caller should exit).
 */
export function deriveStatus(eventName, { notificationType, source } = {}) {
  if (eventName === 'Notification' && notificationType === 'permission_prompt') {
    return 'permission';
  }
  if (eventName === 'SessionStart' && source === 'resume') {
    return 'idle';
  }
  return STATUS_MAP[eventName] ?? null;
}

/**
 * Extract project name from cwd path.
 */
export function deriveProject(cwd) {
  if (!cwd) return 'unknown';
  const name = basename(cwd);
  return name || 'unknown';
}

/**
 * Truncate message to maxLen, appending "..." if truncated.
 */
export function truncateMessage(msg, maxLen = 120) {
  if (!msg) return '';
  if (msg.length <= maxLen) return msg;
  return msg.slice(0, maxLen - 3) + '...';
}

/**
 * Resolve the last_message to display.
 * Priority: prompt > message > previousMessage > empty.
 */
export function resolveLastMessage(prompt, message, previousMessage) {
  const current = prompt || message || '';
  if (current) return truncateMessage(current);
  return previousMessage || '';
}

/**
 * Preserve sound_pack, desktop_index, and last_message from existing state.
 */
export function preserveFields(existingState, newFields) {
  const result = { ...newFields };

  // Preserve monitor-assigned fields from existing state
  if (existingState) {
    if (!result.sound_pack && existingState.sound_pack) {
      result.sound_pack = existingState.sound_pack;
    }
    if (result.desktop_index == null && existingState.desktop_index != null) {
      result.desktop_index = existingState.desktop_index;
    }
  }

  return result;
}

/**
 * Build the state JSON object with proper null coercion.
 * Empty strings become null for optional fields.
 */
export function buildStateJson({
  sessionId,
  status,
  project,
  cwd,
  hookEvent,
  notificationType,
  lastMessage,
  claudePid,
  soundPack,
  desktopIndex,
  timestamp,
}) {
  return {
    session_id: sessionId,
    status,
    project,
    cwd: cwd || '',
    hook_event: hookEvent,
    notification_type: notificationType || null,
    last_message: lastMessage || '',
    claude_pid: claudePid ? Number(claudePid) : null,
    sound_pack: soundPack || null,
    desktop_index: desktopIndex != null ? Number(desktopIndex) : null,
    timestamp,
  };
}
