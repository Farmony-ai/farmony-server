---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
model: opus
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Codebase Pattern Analysis (CRITICAL)**: Before designing the solution, understand existing patterns:

   a. **Find Similar Features**: Use the `Task` tool with `subagent_type: "codebase-pattern-finder"` to find similar implementations:
   ```
   prompt: "Find existing patterns for [key feature aspects from spec]. Looking for:
   - Similar service/controller implementations
   - Database schema patterns (Mongoose models with similar structure)
   - API endpoint patterns for similar operations
   - Authentication/authorization patterns
   - Error handling and validation patterns

   Feature context: [brief spec summary]"
   description: "Find codebase patterns for planning"
   ```

   b. **Identify Integration Points**: Use the `Task` tool with `subagent_type: "codebase-analyzer"` to understand modules you'll integrate with:
   ```
   prompt: "Analyze the following existing modules to understand integration requirements:
   - [List modules from spec that will be affected]
   - Focus on: exports, interfaces, data models, common patterns
   - Note: authentication guards, validation patterns, error handling

   I need to understand the existing architecture to maintain consistency."
   description: "Analyze integration points"
   ```

   c. **Determine File Structure**: Use the `Task` tool with `subagent_type: "codebase-locator"` to identify where new code should live:
   ```
   prompt: "Locate files and directories for [feature domain from spec]:
   - Find the correct domain module (Identity/Marketplace/Transactions/Engagement/Dashboard)
   - Identify existing directory structure in that module
   - Find similar feature organizations
   - Note naming conventions for controllers, services, DTOs, schemas"
   description: "Locate target module structure"
   ```

   d. **Research Best Practices** (Optional - only if new technology/pattern introduced): If the feature requires unfamiliar tech or patterns not found in codebase, use the `Task` tool with `subagent_type: "web-search-researcher"`:
   ```
   prompt: "Research best practices for [specific technology/pattern]:
   - Official documentation and recommended patterns
   - NestJS + MongoDB specific approaches
   - Common pitfalls and anti-patterns
   - Performance considerations"
   description: "Research tech stack patterns"
   ```

   **Consolidate Findings**: Create a "Codebase Patterns" section in research.md documenting:
   - Similar implementations found and their locations
   - Integration points identified
   - File structure conventions
   - Patterns to follow vs. patterns to avoid

4. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:

    - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
    - Fill Constitution Check section from constitution
    - Evaluate gates (ERROR if violations unjustified)
    - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
    - Phase 1: Generate data-model.md, contracts/, quickstart.md
    - Phase 1: Update agent context by running the agent script
    - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:

    - For each NEEDS CLARIFICATION → research task
    - For each dependency → best practices task
    - For each integration → patterns task

2. **Generate and dispatch research agents**:

    ```text
    For each unknown in Technical Context:
      Task: "Research {unknown} for {feature context}"
    For each technology choice:
      Task: "Find best practices for {tech} in {domain}"
    ```

3. **Consolidate findings** in `research.md` using format:
    - Decision: [what was chosen]
    - Rationale: [why chosen]
    - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:

    - Entity name, fields, relationships
    - Validation rules from requirements
    - State transitions if applicable

2. **Generate API contracts** from functional requirements:

    - For each user action → endpoint
    - Use standard REST/GraphQL patterns
    - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
    - Run `.specify/scripts/bash/update-agent-context.sh claude`
    - These scripts detect which AI agent is in use
    - Update the appropriate agent-specific context file
    - Add only new technology from current plan
    - Preserve manual additions between markers

**Output**: data-model.md, /contracts/\*, quickstart.md, agent-specific file

## Key rules

-   Use absolute paths
-   ERROR on gate failures or unresolved clarifications
