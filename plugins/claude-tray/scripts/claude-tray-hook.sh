#!/bin/bash
# Shim: forwards to the mjs rewrite. Remove after all sessions restart.
exec node "$(dirname "$0")/claude-tray-hook.mjs"
