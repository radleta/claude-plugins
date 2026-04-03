#!/usr/bin/env node
/**
 * scratch.mjs - Cross-platform scratch folder lifecycle manager
 *
 * Handles scratch folder lifecycle:
 * - save: Commit folder to main branch (keep working)
 * - archive: Move folder to archive branch (hide from agents)
 * - list: Show active folders on main
 * - archived: Show archived folders
 * - config: Show or update configuration
 *
 * Usage:
 *   scratch save my-feature
 *   scratch archive old-feature
 *   scratch list
 *   scratch archived
 *   scratch config
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// Get script directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const DEFAULT_ARCHIVE_BRANCH = 'archive';

// Dynamically resolved paths (set in main after finding repo root)
let SCRATCH_DIR = null;
let CONFIG_FILE = null;

/**
 * Find the repository root by looking for .git directory
 * Walks up from script directory until it finds .git or reaches filesystem root
 */
function findRepoRoot() {
  // Prioritize CWD if it has a scratch folder (handles symlinked skills)
  const cwdScratch = join(process.cwd(), 'scratch');
  if (existsSync(cwdScratch)) {
    return process.cwd();
  }

  let current = __dirname;

  while (true) {
    // Check if .git exists at this level
    if (existsSync(join(current, '.git'))) {
      return current;
    }
    // Also check if we're inside .claude (skill is in repo)
    const parent = dirname(current);
    if (basename(current) === '.claude' && existsSync(join(parent, '.git'))) {
      return parent;
    }
    // Stop if we've reached filesystem root (parent equals current)
    if (parent === current) {
      break;
    }
    current = parent;
  }

  // If no .git found, fall back to parent of .claude directory
  // This handles the case where script is in .claude/skills/scratch-management/
  const claudeIndex = __dirname.indexOf('.claude');
  if (claudeIndex > 0 && existsSync(join(__dirname.substring(0, claudeIndex - 1), 'scratch'))) {
    return __dirname.substring(0, claudeIndex - 1);
  }

  // Last resort: use current working directory
  return process.cwd();
}

/**
 * Initialize paths based on repository root
 */
function initializePaths() {
  const repoRoot = findRepoRoot();
  SCRATCH_DIR = join(repoRoot, 'scratch');
  CONFIG_FILE = join(SCRATCH_DIR, '.scratch-config.json');
}

// ANSI color codes for cross-platform terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Write status message with color
 */
function writeStatus(message, type = 'Info') {
  const prefixes = {
    Success: `${colors.green}[OK]${colors.reset}`,
    Error: `${colors.red}[ERROR]${colors.reset}`,
    Warning: `${colors.yellow}[WARN]${colors.reset}`,
    Info: `${colors.cyan}[INFO]${colors.reset}`,
  };
  console.log(`${prefixes[type] || prefixes.Info} ${message}`);
}

/**
 * Execute git command and return stdout
 * Throws on non-zero exit code
 */
function git(args, options = {}) {
  const cwd = options.cwd || SCRATCH_DIR;
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    shell: false,
  });

  if (result.error) {
    throw new Error(`Failed to execute git: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errorOutput = (result.stderr || result.stdout || '').trim();
    throw new Error(`Git command failed: git ${args.join(' ')}\n${errorOutput}`);
  }

  return (result.stdout || '').trim();
}

/**
 * Execute git command silently (ignore errors)
 * Returns { success: boolean, stdout: string, stderr: string, error: Error|null }
 */
function gitSilent(args, options = {}) {
  const cwd = options.cwd || SCRATCH_DIR;
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    shell: false,
  });

  // Handle spawn errors (e.g., git not found)
  if (result.error) {
    return {
      success: false,
      stdout: '',
      stderr: result.error.message,
      error: result.error,
    };
  }

  return {
    success: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: null,
  };
}

/**
 * Prompt user for input (async)
 */
async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Load or create configuration
 * Prompts for project name if not set
 */
async function loadConfig() {
  let config = {
    projectName: null,
    archiveBranch: DEFAULT_ARCHIVE_BRANCH,
  };

  // Try to load existing config with secure parsing
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(content);

      // Validate structure (prevents prototype pollution via malformed JSON)
      if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
        throw new Error('Invalid config format: must be an object');
      }

      // Whitelist allowed keys (prevents prototype pollution via __proto__, constructor, etc.)
      const allowedKeys = ['projectName', 'archiveBranch'];
      const sanitized = {};

      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(saved, key) && typeof saved[key] === 'string') {
          sanitized[key] = saved[key];
        }
      }

      // Validate archiveBranch if present
      if (sanitized.archiveBranch) {
        try {
          validateBranchName(sanitized.archiveBranch);
        } catch (branchError) {
          writeStatus(
            `Invalid archive branch name in config, using default: ${branchError.message}`,
            'Warning'
          );
          sanitized.archiveBranch = DEFAULT_ARCHIVE_BRANCH;
        }
      }

      config = { ...config, ...sanitized };
    } catch (error) {
      // Only warn about parse errors, not validation errors we already handled
      if (!error.message?.includes('Invalid config')) {
        writeStatus(`Config file parse error, using defaults: ${error.message}`, 'Warning');
      }
    }
  }

  // Prompt for project name if not set
  if (!config.projectName) {
    console.log('');
    console.log(`${colors.cyan}First-time setup${colors.reset}`);
    console.log('');

    // Try to auto-detect from git remote or directory name
    let suggestion = '';
    try {
      const remoteUrl = gitSilent(['remote', 'get-url', 'origin']);
      if (remoteUrl.success && remoteUrl.stdout) {
        // Extract repo name from URL (handles both HTTPS and SSH)
        const match = remoteUrl.stdout.match(/[/:]([^/]+?)(?:\.git)?$/);
        if (match) {
          suggestion = match[1];
        }
      }
    } catch {
      // Fall back to parent directory name
      suggestion = basename(dirname(SCRATCH_DIR));
    }

    if (!suggestion) {
      suggestion = basename(dirname(SCRATCH_DIR));
    }

    const promptText = suggestion
      ? `Project name [${suggestion}]: `
      : 'Project name: ';

    const answer = await prompt(promptText);
    config.projectName = answer || suggestion;

    if (!config.projectName) {
      writeStatus('Project name is required', 'Error');
      process.exit(1);
    }

    // Save config
    saveConfig(config);
    writeStatus(`Configuration saved to ${CONFIG_FILE}`, 'Success');
    console.log('');
  }

  return config;
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  // Ensure scratch directory exists
  if (!existsSync(SCRATCH_DIR)) {
    mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Validate folder name for security
 * Prevents command injection and path traversal
 */
function validateFolderName(name) {
  if (!name || name.trim() === '') {
    writeStatus('Folder name cannot be empty', 'Error');
    process.exit(1);
  }

  // Only allow alphanumeric, hyphens, underscores (no spaces, dots, slashes)
  // This regex inherently prevents path traversal (no ., /, or \ allowed)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    writeStatus(
      `Invalid folder name '${name}'. Use only: letters, numbers, hyphens, underscores`,
      'Error'
    );
    process.exit(1);
  }

  // Enforce reasonable length
  if (name.length > 100) {
    writeStatus('Folder name too long (max 100 characters)', 'Error');
    process.exit(1);
  }

  // Validate resolved path is within scratch directory
  const fullPath = join(SCRATCH_DIR, name);
  const resolvedPath = resolve(fullPath);
  const resolvedScratch = resolve(SCRATCH_DIR);

  if (!resolvedPath.startsWith(resolvedScratch + (process.platform === 'win32' ? '\\' : '/'))) {
    writeStatus('Path traversal detected. Operation blocked.', 'Error');
    process.exit(1);
  }
}

/**
 * Validate branch name for security
 * Prevents command injection via branch names in git commands
 */
function validateBranchName(name) {
  if (!name || name.trim() === '') {
    throw new Error('Branch name cannot be empty');
  }

  // Git branch name rules:
  // - Alphanumeric, hyphens, underscores, forward slashes
  // - Cannot start with hyphen (prevents flag injection)
  // - Cannot contain consecutive dots (git restriction)
  if (!/^[a-zA-Z0-9/_-]+$/.test(name)) {
    throw new Error(
      `Invalid branch name '${name}'. Use only: letters, numbers, hyphens, underscores, forward slashes`
    );
  }

  if (name.startsWith('-')) {
    throw new Error('Branch name cannot start with hyphen');
  }

  if (name.includes('..')) {
    throw new Error('Branch name cannot contain consecutive dots');
  }

  // Enforce reasonable length
  if (name.length > 255) {
    throw new Error('Branch name too long (max 255 characters)');
  }

  return name;
}

/**
 * Sanitize commit message content
 * Removes control characters and validates content
 * Defense in depth: even with shell:false, ensure messages are safe
 */
function sanitizeCommitMessage(message) {
  if (typeof message !== 'string') {
    throw new Error('Commit message must be a string');
  }

  // Remove control characters (0x00-0x1f, 0x7f-0x9f)
  let sanitized = message.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce reasonable length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  if (sanitized.length === 0) {
    throw new Error('Commit message cannot be empty after sanitization');
  }

  return sanitized;
}

/**
 * Check if scratch repo is initialized
 */
function checkScratchRepo() {
  const gitDir = join(SCRATCH_DIR, '.git');
  if (!existsSync(gitDir)) {
    writeStatus('Scratch repo not initialized. Run /init-repo first.', 'Error');
    process.exit(1);
  }
}

/**
 * Check if folder exists in scratch directory
 */
function checkFolderExists(name) {
  const path = join(SCRATCH_DIR, name);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    writeStatus(`Folder '${name}' not found in scratch/`, 'Error');
    console.log('\nAvailable folders:');
    const folders = getFolders();
    if (folders.length === 0) {
      console.log('  (none)');
    } else {
      folders.forEach((f) => console.log(`  - ${f}`));
    }
    process.exit(1);
  }
}

/**
 * Get list of folders in scratch directory (excluding .git)
 */
function getFolders() {
  if (!existsSync(SCRATCH_DIR)) {
    return [];
  }

  return readdirSync(SCRATCH_DIR).filter((name) => {
    if (name === '.git' || name.startsWith('.')) return false;
    const fullPath = join(SCRATCH_DIR, name);
    return statSync(fullPath).isDirectory();
  });
}

/**
 * Get folder state (committed or uncommitted)
 */
function getFolderState(name) {
  const status = gitSilent(['status', '--porcelain', `${name}/`]);
  if (status.stdout) {
    return 'uncommitted';
  }

  // Check if folder is tracked in git
  const tracked = gitSilent(['ls-files', `${name}/`]);
  if (tracked.stdout) {
    return 'committed';
  }

  return 'uncommitted';
}

/**
 * Initialize archive branch if it doesn't exist
 */
async function initializeArchiveBranch(config) {
  const branchExists = gitSilent(['branch', '--list', config.archiveBranch]);

  if (!branchExists.stdout) {
    writeStatus('Creating archive branch (first-time setup)...', 'Info');

    try {
      git(['checkout', '--orphan', config.archiveBranch]);

      // Clear the staging area (orphan branch inherits staged files from previous branch)
      git(['rm', '-rf', '--cached', '.']);

      const readmeContent = `# Scratch Archive\n\nArchived projects from ${config.projectName}.\nUse main branch for active projects.`;
      writeFileSync(join(SCRATCH_DIR, 'README.md'), readmeContent, 'utf-8');

      git(['add', 'README.md']);
      git(['commit', '-m', sanitizeCommitMessage('Initialize archive branch')]);
      git(['checkout', 'main']);
      git(['push', '-u', 'origin', config.archiveBranch]);

      writeStatus('Archive branch created', 'Success');
    } catch (error) {
      // Cleanup: try to return to main branch on failure
      gitSilent(['checkout', 'main']);
      throw new Error(`Failed to create archive branch: ${error.message}`);
    }
  }
}

/**
 * Sync archive branch with remote
 */
async function syncArchiveBranch(config) {
  writeStatus('Fetching latest from remote...', 'Info');
  git(['fetch', 'origin']);

  // Check if archive branch exists locally
  const archiveExists = gitSilent(['branch', '--list', config.archiveBranch]);
  if (!archiveExists.stdout) {
    return; // No local archive branch yet
  }

  // Check if remote archive exists
  const remoteArchiveExists = gitSilent(['ls-remote', '--heads', 'origin', config.archiveBranch]);
  if (!remoteArchiveExists.stdout) {
    return; // No remote archive branch
  }

  // Get current branch to restore later
  const currentBranch = gitSilent(['branch', '--show-current']).stdout;

  // Check if local archive is behind remote
  const behindCount = gitSilent([
    'rev-list',
    '--count',
    `${config.archiveBranch}..origin/${config.archiveBranch}`,
  ]);

  const behindCountNum = parseInt(behindCount.stdout, 10);
  if (behindCount.success && !isNaN(behindCountNum) && behindCountNum > 0 && behindCountNum < Number.MAX_SAFE_INTEGER) {
    writeStatus(
      `Archive branch is ${behindCount.stdout} commit(s) behind remote, syncing...`,
      'Info'
    );

    git(['checkout', config.archiveBranch]);

    try {
      // Try fast-forward first
      const ffResult = gitSilent(['merge', '--ff-only', `origin/${config.archiveBranch}`]);
      if (ffResult.success) {
        writeStatus('Archive branch synced (fast-forward)', 'Success');
      } else {
        // Try automatic merge
        writeStatus('Fast-forward not possible, attempting auto-merge...', 'Info');
        const mergeResult = gitSilent(['merge', `origin/${config.archiveBranch}`, '--no-edit']);
        if (!mergeResult.success) {
          // Check for conflicts
          const conflictCheck = gitSilent(['diff', '--name-only', '--diff-filter=U']);
          if (conflictCheck.stdout) {
            gitSilent(['merge', '--abort']);
            throw new Error(
              `Merge conflict in archive branch. Manual resolution required.\nConflicting files: ${conflictCheck.stdout}`
            );
          }
          throw new Error(`Failed to sync archive branch: ${mergeResult.stderr}`);
        }
        writeStatus('Archive branch synced (auto-merge)', 'Success');
      }
    } finally {
      // Return to original branch
      if (currentBranch && currentBranch !== config.archiveBranch) {
        gitSilent(['checkout', currentBranch]);
      }
    }
  } else {
    writeStatus('Archive branch is up to date', 'Info');
  }
}

/**
 * Save command - commit folder to main branch
 */
async function cmdSave(folder, config) {
  validateFolderName(folder);
  checkScratchRepo();
  checkFolderExists(folder);

  const state = getFolderState(folder);

  if (state === 'committed') {
    const changes = gitSilent(['status', '--porcelain', `${folder}/`]);
    if (!changes.stdout) {
      writeStatus(`Folder '${folder}' already saved, no new changes`, 'Warning');
      return;
    }
  }

  writeStatus(`Saving '${folder}' to main branch...`, 'Info');

  const commitMessage = sanitizeCommitMessage(`Save: ${folder}`);

  git(['add', `${folder}/`]);
  git(['commit', '-m', commitMessage]);
  git(['push', 'origin', 'main']);

  console.log('');
  writeStatus('Folder saved successfully', 'Success');
  console.log('');
  console.log(`  Folder: ${folder}`);
  console.log('  Branch: main');
  console.log('  Status: Committed and pushed');
  console.log('');
  console.log('  Folder remains active (visible to agents).');
  console.log(`  To archive when done: scratch archive ${folder}`);
}

/**
 * Archive command - move folder to archive branch
 */
async function cmdArchive(folder, config) {
  validateFolderName(folder);
  checkScratchRepo();
  checkFolderExists(folder);
  await initializeArchiveBranch(config);
  await syncArchiveBranch(config);

  const state = getFolderState(folder);
  writeStatus(`Archiving '${folder}' (${state})...`, 'Info');

  const archiveCommitMsg = sanitizeCommitMessage(`Archive: ${folder}`);
  const removeCommitMsg = sanitizeCommitMessage(`Archived ${folder} to archive branch`);

  let tempDir = null;
  let archiveSucceeded = false;

  try {
    if (state === 'uncommitted') {
      // Path A: Uncommitted folder - TRANSACTIONAL approach
      // Order: copy -> commit to archive -> push archive -> THEN delete from main

      // Use random UUID for unique temp directory
      tempDir = join(tmpdir(), `scratch-archive-${folder}-${randomUUID()}`);

      // Step 1: Copy folder to temp (backup)
      cpSync(join(SCRATCH_DIR, folder), tempDir, { recursive: true });
      writeStatus('Backup created', 'Info');

      // Step 2: Switch to archive branch and add folder
      git(['checkout', config.archiveBranch]);
      cpSync(tempDir, join(SCRATCH_DIR, folder), { recursive: true });
      git(['add', `${folder}/`]);
      git(['commit', '-m', archiveCommitMsg]);

      // Step 3: Push archive branch BEFORE deleting from main
      git(['push', 'origin', config.archiveBranch]);
      writeStatus('Archived to remote', 'Info');

      // Step 4: NOW safe to switch back to main
      git(['checkout', 'main']);
      // Git checkout removes the folder (it's tracked on archive, not on main)
      const folderPath = join(SCRATCH_DIR, folder);
      if (existsSync(folderPath)) {
        rmSync(folderPath, { recursive: true, force: true });
        writeStatus('Untracked folder removed from working tree', 'Info');
      } else {
        writeStatus('Folder cleaned up by git checkout', 'Info');
      }
      // Note: No push needed - folder was never tracked on main (uncommitted)
    } else {
      // Path B: Committed folder - TRANSACTIONAL approach
      // Order: copy to archive -> push archive -> THEN remove from main

      // Step 1: Switch to archive and copy folder from main
      git(['checkout', config.archiveBranch]);

      // Check if folder already exists on archive branch
      const existsOnArchive = gitSilent(['ls-tree', '--name-only', config.archiveBranch, folder]);
      if (existsOnArchive.stdout) {
        writeStatus('Folder already exists on archive branch, skipping archive step', 'Info');
      } else {
        git(['checkout', 'main', '--', `${folder}/`]);
        git(['add', `${folder}/`]);
        git(['commit', '-m', archiveCommitMsg]);

        // Push archive BEFORE removing from main
        git(['push', 'origin', config.archiveBranch]);
        writeStatus('Archived to remote', 'Info');
      }

      // Step 2: NOW safe to remove from main
      git(['checkout', 'main']);
      git(['rm', '-r', `${folder}/`]);
      git(['commit', '-m', removeCommitMsg]);
      git(['push', 'origin', 'main']);
    }

    archiveSucceeded = true;

    console.log('');
    writeStatus('Folder archived successfully', 'Success');
    console.log('');
    console.log(`  Folder: ${folder}`);
    console.log(`  Source: ${state}`);
    console.log('  Action: Archived to archive branch');
    console.log('');
    console.log('  Main branch: Folder removed (agents cannot see)');
    console.log('  Archive branch: Folder preserved (for reference)');
    console.log('');
    console.log('  To view archived: scratch archived');
  } catch (error) {
    writeStatus(`Archive operation failed: ${error.message}`, 'Error');

    // Attempt recovery: return to main branch
    writeStatus('Attempting recovery...', 'Warning');
    const currentBranch = gitSilent(['branch', '--show-current']).stdout;
    if (currentBranch !== 'main') {
      const checkoutResult = gitSilent(['checkout', 'main']);
      if (checkoutResult.success) {
        writeStatus('Returned to main branch', 'Info');
      } else {
        writeStatus('Could not return to main branch. Manual intervention required.', 'Error');
        writeStatus(`Current branch: ${currentBranch}`, 'Error');
        console.log('  Run: git -C scratch checkout main --force');
      }
    } else {
      writeStatus('Already on main branch', 'Info');
    }

    // Check for uncommitted changes
    const statusCheck = gitSilent(['status', '--porcelain']);
    if (statusCheck.stdout) {
      writeStatus('Repository has uncommitted changes:', 'Warning');
      statusCheck.stdout.split('\n').forEach((line) => console.log(`    ${line}`));
      console.log('  Review with: git -C scratch status');
    }

    process.exit(1);
  } finally {
    // Clean up temp directory
    if (tempDir && existsSync(tempDir)) {
      if (archiveSucceeded) {
        try {
          rmSync(tempDir, { recursive: true, force: true });
        } catch {
          writeStatus(`Could not delete temp backup: ${tempDir}`, 'Warning');
        }
      } else {
        writeStatus(`Backup preserved at: ${tempDir}`, 'Warning');
        console.log('  You can manually recover your files from this location.');
      }
    }
  }
}

/**
 * List command - show active folders on main branch
 */
async function cmdList() {
  checkScratchRepo();

  console.log('');
  console.log(`${colors.cyan}Active folders in scratch/ (main branch):${colors.reset}`);
  console.log('');

  const folders = getFolders();

  if (folders.length === 0) {
    console.log('  (none)');
  } else {
    for (const folder of folders) {
      const state = getFolderState(folder);
      const stateLabel = state === 'uncommitted' ? '[uncommitted]' : '[saved]';
      const color = state === 'uncommitted' ? colors.yellow : colors.green;
      console.log(`  - ${folder} ${color}${stateLabel}${colors.reset}`);
    }
  }
  console.log('');
}

/**
 * Archived command - show archived folders
 */
async function cmdArchived(config) {
  checkScratchRepo();

  const archiveExists = gitSilent(['branch', '--list', config.archiveBranch]);
  if (!archiveExists.stdout) {
    console.log('');
    console.log(`${colors.yellow}Archive branch not yet created.${colors.reset}`);
    console.log(`${colors.yellow}It will be created on first archive.${colors.reset}`);
    console.log('');
    return;
  }

  console.log('');
  console.log(`${colors.cyan}Archived folders (archive branch):${colors.reset}`);
  console.log('');

  const lsTree = gitSilent(['ls-tree', '--name-only', config.archiveBranch]);
  const folders = lsTree.stdout
    .split('\n')
    .filter((name) => name && name !== 'README.md');

  if (folders.length === 0) {
    console.log('  (none)');
  } else {
    folders.forEach((folder) => console.log(`  - ${folder}`));
  }
  console.log('');
  console.log(
    `${colors.gray}To view contents: git -C scratch show ${config.archiveBranch}:FOLDER/README.md${colors.reset}`
  );
  console.log('');
}

/**
 * Config command - show or update configuration
 */
async function cmdConfig(config) {
  console.log('');
  console.log(`${colors.cyan}Current configuration:${colors.reset}`);
  console.log('');
  console.log(`  Project name:    ${config.projectName}`);
  console.log(`  Archive branch:  ${config.archiveBranch}`);
  console.log(`  Config file:     ${CONFIG_FILE}`);
  console.log('');
}

/**
 * Show help
 */
function showHelp() {
  console.log('');
  console.log(`${colors.cyan}scratch.mjs - Cross-platform scratch folder manager${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}Usage:${colors.reset}`);
  console.log('  scratch COMMAND [folder]');
  console.log('');
  console.log(`${colors.yellow}Commands:${colors.reset}`);
  console.log('  save FOLDER       Commit folder to main branch (keep working)');
  console.log('  archive FOLDER    Move folder to archive branch (hide from agents)');
  console.log('  list              Show active folders on main branch');
  console.log('  archived          Show archived folders');
  console.log('  config            Show current configuration');
  console.log('  help              Show this help');
  console.log('');
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log('  scratch save my-feature       # Save work in progress');
  console.log('  scratch archive old-feature   # Archive completed work');
  console.log('  scratch list                  # See active folders');
  console.log('  scratch archived              # See archived folders');
  console.log('');
}

/**
 * Check if git is available
 */
function checkGitAvailable() {
  const result = spawnSync('git', ['--version'], {
    encoding: 'utf-8',
    shell: false,
  });

  if (result.error) {
    writeStatus('Git is not installed or not in PATH', 'Error');
    writeStatus('Please install Git and ensure it is available in your PATH', 'Error');
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  // Check git is available before anything else
  checkGitAvailable();

  // Initialize paths based on repository root
  initializePaths();

  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const folder = args[1];

  // Help doesn't need config
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Load config (prompts on first run)
  const config = await loadConfig();

  switch (command) {
    case 'save':
      if (!folder) {
        writeStatus('Folder name required. Usage: scratch save FOLDER', 'Error');
        process.exit(1);
      }
      await cmdSave(folder, config);
      break;

    case 'archive':
      if (!folder) {
        writeStatus('Folder name required. Usage: scratch archive FOLDER', 'Error');
        process.exit(1);
      }
      await cmdArchive(folder, config);
      break;

    case 'list':
      await cmdList();
      break;

    case 'archived':
      await cmdArchived(config);
      break;

    case 'config':
      await cmdConfig(config);
      break;

    default:
      writeStatus(`Unknown command: ${command}`, 'Error');
      showHelp();
      process.exit(1);
  }
}

// Run
main().catch((error) => {
  writeStatus(`Unexpected error: ${error.message}`, 'Error');
  process.exit(1);
});
