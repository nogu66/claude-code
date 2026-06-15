---
name: fable-implementation-flow
description: "Build software features, apps, games, prototypes, or bug fixes with a Fable-style implementation workflow: infer scope, inspect relevant docs and project structure, design concrete architecture, implement end to end, validate numerically and with builds/tests, debug by causal replay, and summarize clearly. Use when the user asks to implement using a provided thought process, 'Fable thought', 'Fable風', '思考プロセス', '実装ログのように', or wants thorough from-brief-to-working-code execution rather than only advice."
---

# Fable Implementation Flow

## Core Stance

Use this skill to convert a broad implementation request into a finished, verified result. Work from the user's brief toward running code, not toward a plan alone, unless the user explicitly asks only for planning.

Do not reveal or reproduce hidden chain-of-thought. If the user provides thought logs, extract the reusable engineering behavior: visible assumptions, concise rationale, concrete checks, and implementation steps.

Keep the user informed with short progress updates. Say what context is being gathered, what decision has been made, or what is being changed. Once enough context is known, move decisively.

## Workflow

1. Frame the request.
   - Identify platform, framework, file type, orientation, UI language, target device, asset needs, persistence, performance limits, and verification path.
   - If the request is inspired by an existing game/product, preserve the mechanic or feel while creating original names, visuals, and assets. Avoid trademarks and copied art.
   - If details are missing but a safe choice is obvious from the repo or user language, assume it and proceed.

2. Gather local context first.
   - Read relevant project files, config, templates, package metadata, and existing conventions before editing.
   - Load applicable skills or official docs when the task depends on them.
   - Parallelize independent reads with available tooling.
   - Verify tool schemas and generated asset behavior before relying on them.

3. Choose a concrete architecture.
   - Name the main state objects, renderers/controllers, services, views, data models, and persistence boundary.
   - Pick proven libraries or engines for core rules, physics, rendering, parsing, or file formats when appropriate.
   - Define important constants early: dimensions, coordinates, speeds, timers, collision categories, economy values, budgets, and thresholds.
   - Check concurrency/isolation constraints explicitly for the chosen stack, such as Swift `MainActor`, React lifecycle cleanup, async tasks, or frame-update subscriptions.

4. Start long-running work early.
   - Launch asset, icon, audio, install, or build tasks in the background when available and safe.
   - Continue implementing while those tasks run.
   - After generation or import, inspect actual filenames, formats, and bundle locations before wiring references in code.
   - Provide deterministic fallbacks when external generation fails or assets are missing.

5. Implement foundation outward.
   - Update app/project configuration first when needed: routing, orientation, permissions, bundle resources, build settings, or entry points.
   - Add models and constants before managers.
   - Add core mechanics before polish.
   - Add UI overlays, controls, localization, animations, haptics, and sound after the main loop works.
   - Keep files organized by responsibility, but avoid abstractions that do not remove real complexity.

6. Validate by replaying the system.
   - Walk through critical flows step by step: input, state mutation, rendering, side effects, persistence, and cleanup.
   - Check numerical edge cases: bounds, collision overlaps, spawn positions, tile connectivity, physics impulses, cooldowns, entity counts, mobile screen fit, and performance budgets.
   - For games and visual apps, verify that the first screen is the playable or usable experience, not a placeholder.
   - Run the relevant build, tests, lint, typecheck, renderer, or browser/device checks.

7. Fix errors with tight feedback loops.
   - Treat compiler, runtime, or visual errors as signals to inspect the exact API and nearby code.
   - Prefer minimal, local fixes that preserve the intended design.
   - When debugging a user-reported symptom, replay the timeline from user action to failure. Identify the root cause, compare plausible fixes, check edge cases, implement, then rebuild or retest.

8. Finish with evidence.
   - Confirm the feature is implemented, assets are bundled, generated files are referenced by their real names, and validation passed.
   - Summarize what changed, how it was verified, and any residual risk or skipped check.
   - Keep the final response concise and practical.

## Implementation Heuristics

- Prefer repo conventions over new patterns.
- Preserve user language in UI text when clear; use Japanese UI labels for Japanese game/app requests.
- For mobile controls, check screen fit, safe areas, touch targets, and overlap between HUD and controls.
- For physics or collision systems, compute representative values instead of tuning blindly.
- For grid or maze systems, verify every row/column width and connectivity before calling it done.
- For generated assets, plan for missing or mismatched names, and use fallback rendering where possible.
- For performance-sensitive scenes, limit entity counts, reuse meshes/materials, render only visible surfaces, and clean up subscriptions or timers.
- For inspired designs, state internally and in the final summary that original assets/names were used when relevant.

## Visible Output Style

Expose useful conclusions, not private reasoning. Good visible output includes:

- "I found the project is portrait-only already, so I am keeping that setting."
- "The launch issue comes from the plunger body returning before the ball clears it; I am delaying the reset and retesting."
- "The maze rows are all 19 columns and the tunnel connects through columns 4 and 14."
- "Build passed after fixing the API call order."

Avoid dumping long internal deliberation. Convert it into decisions, checks, and results.
