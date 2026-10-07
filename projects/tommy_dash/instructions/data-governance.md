# Tommy Dash data governance

## Geography contract

National calculations must include exactly these source region codes:

```text
CE, EA, MA, MS, NH, SC, SO, WE
```

The visible geography selector must include `NTL` plus CE, EA, MA, MS, SC,
SO, and WE. It must never expose NH as a selectable or plotted region.

National shares are calculated from summed components, never from an average
of regional shares:

```text
national share = sum of the eight-region numerator
                 / sum of the eight-region denominator
```

Both the target numerator and the complete eligible denominator must contain
NH. Unassigned and all other region codes are excluded.

## Narrative contract

The first `why` narrative is eligible only when the selected geography is
National (`NTL`) and the reporting period is September 2026 (`2026-09`). The
selected model may shape the evidence pack, but no other geography or period
may receive generated analysis during this phase.

Agent-authored text must remain additive. It may not calculate, change,
backfill, or reconcile any KPI. Every factual external claim must retain its
source and publication date.
