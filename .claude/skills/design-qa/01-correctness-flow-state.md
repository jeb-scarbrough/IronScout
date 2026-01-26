# A) Correctness / Flow / State

Purpose: Validate structural UX integrity before copy or polish.

Checks:
- Each surface has exactly one job.
- No competing primary actions.
- Clear handoff between Search → Saved → Dashboard.
- All states defined: loading, empty, stale, error.

Hard blockers:
- Duplicate surfaces answering the same question.
- UI elements without an explainable reason for existence.
- State changes without explanation.
