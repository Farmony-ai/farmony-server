# Branch Workflow Guide

## TL;DR - Your Workflow Now Works!

```bash
# Your preferred workflow (custom branch names):
git checkout -b FAR-123-provider-dashboard
/speckit.specify "Add provider earnings dashboard"
# ✅ Now uses YOUR branch name, creates specs/FAR-123-provider-dashboard/

# Default workflow (auto-numbered branches):
# (only if you're on main/master)
/speckit.specify "Add provider earnings dashboard"
# Creates branch 001-provider-earnings, specs/001-provider-earnings/
```

## What Changed

### 1. Script Modifications

#### `.specify/scripts/bash/create-new-feature.sh`
**Added**: `--use-current-branch` flag
- **Before**: Always created new numbered branch (001-feature-name)
- **After**: Can use your existing branch with custom naming

**How it works:**
```bash
# Auto-detect mode (used by /speckit.specify)
./create-new-feature.sh --json --use-current-branch "Feature description"
# Uses current branch name, creates specs/<your-branch>/
```

#### `.specify/scripts/bash/common.sh`
**Modified**: `check_feature_branch()` validation
- **Before**: Required `^[0-9]{3}-` pattern, failed otherwise
- **After**: Warns about non-standard naming but allows it

**Validation logic:**
- ✅ Custom branches: `FAR-123-feature`, `fix-payment-bug`, etc.
- ✅ Numbered branches: `001-feature-name`
- ❌ main/master: Not allowed

#### `.claude/commands/speckit.specify.md`
**Added**: Auto-detection logic
- Checks current branch
- If on main/master → Creates numbered branch
- If on custom branch → Uses your branch name

### 2. What Each Script Does

| Script | Purpose | When It Runs |
|--------|---------|--------------|
| `create-new-feature.sh` | Creates branch + specs directory | `/speckit.specify` |
| `check-prerequisites.sh` | Validates files exist | All commands |
| `setup-plan.sh` | Copies plan template | `/speckit.plan` |
| `update-agent-context.sh` | Updates agent knowledge | `/speckit.plan` |
| `common.sh` | Shared utilities | All scripts |

## Workflow Comparison

### Before (Forced Naming)
```bash
# You: Create custom branch
git checkout -b FAR-9-dashboard

# Run speckit
/speckit.specify "Add dashboard"

# ❌ ERROR: Not on a feature branch (001-* pattern required)
```

### After (Flexible Naming)
```bash
# Option 1: Your workflow (custom branch)
git checkout -b FAR-9-dashboard
/speckit.specify "Add dashboard"
# ✅ Uses FAR-9-dashboard, creates specs/FAR-9-dashboard/

# Option 2: Default workflow (auto-numbered)
# (from main/master branch)
/speckit.specify "Add dashboard"
# ✅ Creates 001-add-dashboard, creates specs/001-add-dashboard/
```

## How Auto-Detection Works

`/speckit.specify` now automatically chooses the right workflow:

```bash
# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    # Create new numbered branch (default behavior)
    create-new-feature.sh --json "Feature description"
else
    # Use your existing branch (new behavior)
    create-new-feature.sh --json --use-current-branch "Feature description"
fi
```

**Logic:**
1. On main/master → Create numbered branch (001-feature)
2. On custom branch → Use your branch name
3. On numbered branch → Reuse it (you're probably updating the spec)

## Directory Structure

Both workflows create the same structure:

```
specs/
  <branch-name>/          # Your branch or numbered branch
    spec.md               # Feature specification
    plan.md               # Implementation plan (after /speckit.plan)
    tasks.md              # Task breakdown (after /speckit.tasks)
    research.md           # Research findings (optional)
    data-model.md         # Data models (optional)
    contracts/            # API contracts (optional)
    checklists/           # Quality checklists (optional)
```

**Examples:**
- Your branch: `specs/FAR-9-dashboard/spec.md`
- Auto branch: `specs/001-dashboard/spec.md`

## Migration Guide

### If You're Already Using Numbered Branches

No changes needed! The old workflow still works:

```bash
# This still works exactly as before
/speckit.specify "Add feature"
# Creates 001-add-feature
```

### If You Want Custom Branch Names

Just create your branch first:

```bash
# Your ticket naming convention
git checkout -b PROJ-123-feature-name

# Run speckit - it will detect and use your branch
/speckit.specify "Add feature"
# Creates specs/PROJ-123-feature-name/
```

## FAQ

### Q: Do I have to use numbered branches?
**A:** No! Use any branch name you want (except main/master).

### Q: What if I'm already on a feature branch?
**A:** `/speckit.specify` will detect and use it automatically.

### Q: Can I still use the old numbered workflow?
**A:** Yes! Run `/speckit.specify` from main/master to auto-create numbered branches.

### Q: What branch names are allowed?
**A:** Anything except main/master:
- ✅ `FAR-9-dashboard`
- ✅ `fix-payment-bug`
- ✅ `feature/user-auth`
- ✅ `001-numbered-branch`
- ❌ `main` (blocked)
- ❌ `master` (blocked)

### Q: Where do the spec files go?
**A:** Always in `specs/<your-branch-name>/` regardless of naming convention.

### Q: Do other commands (/speckit.plan, /speckit.implement) work?
**A:** Yes! They detect your branch automatically and find the correct specs directory.

## Technical Details

### Branch Detection Logic

The system uses two methods to find your feature directory:

1. **Numeric prefix matching** (for numbered branches):
   - Branch: `001-feature-name`
   - Finds: `specs/001-*/` (any directory with that number)
   - Allows multiple branches per spec (e.g., `001-fix`, `001-refactor`)

2. **Exact name matching** (for custom branches):
   - Branch: `FAR-9-dashboard`
   - Finds: `specs/FAR-9-dashboard/`
   - One-to-one branch-to-spec mapping

### Script Flow

```
/speckit.specify "Feature"
    ↓
Check current branch
    ↓
┌───────────────┬───────────────┐
│  main/master  │  custom branch │
└───────┬───────┴───────┬───────┘
        ↓               ↓
   Create numbered   Use current
   branch (001-)     branch name
        ↓               ↓
        └───────┬───────┘
                ↓
    Create specs/<branch-name>/
                ↓
    Copy spec-template.md
                ↓
            Success!
```

## Version History

- **v2.0** (2025-11-09): Added `--use-current-branch` flag and auto-detection
- **v1.0** (original): Required numbered branches (001-*)

---

**Questions?** Check the scripts with `--help`:
```bash
.specify/scripts/bash/create-new-feature.sh --help
```
