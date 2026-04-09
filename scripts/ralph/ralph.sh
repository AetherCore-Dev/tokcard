#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool amp|claude] [max_iterations]

set -e

# Parse arguments
TOOL="claude"  # Default to claude for this local setup
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi
CLAUDE_CMD="${RALPH_CLAUDE_CMD:-claude-internal}"
CLAUDE_WORKDIR="${RALPH_CLAUDE_WORKDIR:-/tmp}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"
    
    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  STORY_ID=$(jq -r '.userStories | map(select(.passes == false)) | sort_by(.priority) | .[0].id // empty' "$PRD_FILE")
  if [[ -z "$STORY_ID" ]]; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "<promise>COMPLETE</promise>"
    exit 0
  fi

  STORY_TITLE=$(jq -r --arg id "$STORY_ID" '.userStories[] | select(.id == $id) | .title' "$PRD_FILE")
  STORY_DESCRIPTION=$(jq -r --arg id "$STORY_ID" '.userStories[] | select(.id == $id) | .description' "$PRD_FILE")
  STORY_CRITERIA=$(jq -r --arg id "$STORY_ID" '.userStories[] | select(.id == $id) | .acceptanceCriteria[] | "- " + .' "$PRD_FILE")
  BRANCH_NAME=$(jq -r '.branchName' "$PRD_FILE")
  REMAINING_COUNT=$(jq -r '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")

  CLAUDE_PROMPT=$(cat <<EOF
You are Ralph working in the TokCard repo at $REPO_ROOT.

Read only the minimum files you need. Start by reading:
- $REPO_ROOT/scripts/ralph/progress.txt
- $REPO_ROOT/scripts/ralph/prd.json
- $REPO_ROOT/CODEBUDDY.md

Ensure the current branch in $REPO_ROOT is $BRANCH_NAME.

Complete exactly one story in this run:
ID: $STORY_ID
Title: $STORY_TITLE
Description: $STORY_DESCRIPTION
Acceptance criteria:
$STORY_CRITERIA

Requirements:
- Make minimal focused changes for this story only
- Run npm run build before finishing
- If this is UI work and browser tools are unavailable, note manual verification needed in $REPO_ROOT/scripts/ralph/progress.txt
- Commit all changes in $REPO_ROOT with message: feat: $STORY_ID - $STORY_TITLE
- Set this story's passes field to true in $REPO_ROOT/scripts/ralph/prd.json
- Append a short progress entry to $REPO_ROOT/scripts/ralph/progress.txt with changed files and reusable learnings
- There are currently $REMAINING_COUNT unfinished stories including this one
- If this completes the last unfinished story, reply exactly <promise>COMPLETE</promise>
EOF
)

  # Run the selected tool with the current story prompt
  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(amp --dangerously-allow-all "$CLAUDE_PROMPT" 2>&1) || true
  else
    OUTPUT=$(cd "$CLAUDE_WORKDIR" && $CLAUDE_CMD --add-dir "$REPO_ROOT" --tools Bash,Read,Write,Edit,MultiEdit,Glob,Grep --disable-slash-commands --print --permission-mode bypassPermissions --no-session-persistence "$CLAUDE_PROMPT" 2>&1) || true
  fi

  if [[ -n "$OUTPUT" ]]; then
    printf '%s\n' "$OUTPUT"
  fi
  
  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi
  
  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
