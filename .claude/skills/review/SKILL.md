---
name: review
description: Review your own change before opening a pull request in Cauce, against docs/conventions.md and the design sheet of the module. Use after the CI commands pass and before opening or updating a pull request, or when asked to review a change.
---

# Review

Review the change as the person who will receive the pull request would. This skill says **how** to review; the
rules are in the documents, and are not repeated here.

## Before reading the code

1. **Run what CI runs**, and stop until it passes: `pnpm typecheck && pnpm test && pnpm build`. The review does
   not spend its attention on what the tests already catch.
2. **List the packages the change touches**, and read what governs them: [docs/conventions.md](../../../docs/conventions.md),
   the design sheet of each module if `.dev/` exists, and each module's `README.md`. The table in
   [AGENTS.md](../../../AGENTS.md) says which document goes with which change.

## Reading the code

3. **Check the change against the sheet first**: what the sheet asks for that is missing, and what was built that
   the sheet does not ask for.
4. **Then against the conventions**, starting with the rules that break habit in [AGENTS.md](../../../AGENTS.md).
5. **When a finding is a pattern, search the whole repository for it** before calling it fixed. Reading only the
   files of the diff finds one occurrence and leaves the rest.
6. **For every new extension or service, find the test that builds it through `Services`.** A missing registration
   is not visible in any file: only something that builds the container finds it.
7. **Check the public docs and the examples** of each touched module: the `README.md` says what the code does now,
   public API has TSDoc, and the examples use the conference domain and still compile.

## Reporting

For each finding: the file and line, the rule or the section of the sheet, why it is a problem here, and the fix.
Leave out formatting and low-confidence findings.

Fix what you found, run step 1 again, and say in the pull request what the review found and what you changed.
