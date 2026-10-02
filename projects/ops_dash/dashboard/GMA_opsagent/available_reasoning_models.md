# Available Reasoning Models

Last checked: 2026-09-11T17:05:21+00:00

This reflects the model IDs returned by this API project’s `/v1/models` catalog. Suggested efforts are starting points, not guaranteed capability declarations; the API remains authoritative for any model-specific validation.

| Model | Suggested use | Starting reasoning effort |
| --- | --- | --- |
| `gpt-6-astra` | Frontier supervisor or complex diagnosis | medium, high |
| `gpt-5.6-sol` | Higher-quality supervisor | medium, high |
| `gpt-5.6-terra` | Default analyst and iterative supervisor | low, medium |
| `gpt-5.6-luna` | Low-cost experiment or narrow extraction | low, medium |

## Current workflow profiles

See `analysis_profiles.json` for the approved analyst and supervisor combinations, output caps, and hard input limits.
