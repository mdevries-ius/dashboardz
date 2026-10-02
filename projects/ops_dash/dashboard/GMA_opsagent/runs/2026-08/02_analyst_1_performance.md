# Analyst 1 — Performance Diagnosis

## Reporting Context

- Reporting month: August 2026 (2026-08-01).
- Scope: Genesis nationally and across the seven included sales regions; SOI and SOM use the aligned Genesis competitive-segment universe. [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01]
- Data completeness / caveats: This frozen package is a single-month snapshot with M/M and Y/Y deltas. It supports diagnosis of relationships, not proof of causality. Incentive data are national-only, and no trim-level retail-sales data are supplied. Dealer inventory is a geographic reference rather than a dealer sales/conversion measure. [Evidence: data_dictionary.md | Shared data contract | National / regional | 2026-08-01]

## Five Candidate Executive Insights

### 1. Genesis availability remains materially ahead of retail share, even after a strong August sales month

- **Observation:** Genesis held 7.6% SOI versus 4.6% SOM in its aligned competitive universe, a 1.66x availability-to-retail ratio. August retail sales rose 11.0% M/M while inventory rose 3.0% M/M, yet SOI increased 0.45pp against a 0.14pp SOM increase, widening the ratio by 0.05x. Genesis's 1.66x ratio is above BMW (1.38x), Mercedes-Benz (1.35x), Audi (1.19x), and Lexus (0.70x). [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01] [Evidence: competitor_efficiency.csv | Genesis, BMW, Mercedes-Benz, Audi, Lexus | National | 2026-08-01]
- **Interpretation:** **Fact** — August demand improved in absolute volume, but Genesis did not gain retail share at the same rate as availability within its represented segments. **Hypothesis** — the immediate commercial challenge is conversion of available inventory, rather than a broad national inventory shortage.
- **Implication:** Treat the 1.66x ratio as the brand-level diagnostic to decompose by nameplate and region before adding supply. Prioritize demand conversion and allocation where the ratio is highest rather than applying a uniform national incentive response.
- **Evidence:** [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01] [Evidence: competitor_efficiency.csv | Genesis, BMW, Mercedes-Benz, Audi, Lexus | National | 2026-08-01]

### 2. Incentives were reset downward, but Genesis is still above its segment-weighted peer benchmark

- **Observation:** Brand incentive PNV declined 25.7% M/M to $5,412 and the inventory-weighted incentive index declined 31.5 points to 115.3. The index remains above 100, meaning Genesis's inventory-weighted incentives are still above the Cox competitive benchmark. [Evidence: cox_incentives.csv | Genesis | National | 2026-08-01]
- **Interpretation:** **Fact** — the August commercial stance is less incentive-intensive than July but remains premium-to-peer. **Hypothesis** — the ratio deterioration cannot be attributed simply to an August increase in incentive spending; the more useful question is whether the reduction was concentrated in nameplates whose inventory is already outpacing retail share.
- **Implication:** Review incentive reductions against model-level SOI/SOM before assuming the brand-level reset is sufficient. Preserve targeted support where the supply-sales mismatch is large; test whether above-peer spending is still buying incremental share elsewhere.
- **Evidence:** [Evidence: cox_incentives.csv | Genesis | National | 2026-08-01] [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01]

### 3. GV70 is close to balanced in August, but its scale makes it the most consequential conversion watchpoint

- **Observation:** GV70 represents 8,465 average units and 2,858 retail sales, the largest Genesis nameplate on both measures. Its 9.1% SOI and 9.2% SOM yield a near-balanced 0.98x ratio; retail sales rose 6.7% M/M while inventory was essentially flat (-0.2%). Its incentive index fell 46.0 points M/M to 83, below the relevant Cox benchmark. [Evidence: operational_metrics.csv | GV70 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV70 | National | 2026-08-01]
- **Interpretation:** **Fact** — GV70 is not currently the driver of the national availability imbalance. **Hypothesis** — the sharp move to below-peer incentives did not prevent August sales growth because supply was held flat, but its durability should be tested since GV70 remains the largest volume exposure.
- **Implication:** Protect GV70's current balance rather than using it as the primary inventory-release outlet. Monitor its retail share and ratio through the next reporting month before restoring broad incentives.
- **Evidence:** [Evidence: operational_metrics.csv | GV70 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV70 | National | 2026-08-01]

### 4. G80 is the clearest evidence of under-availability relative to segment sales, despite a major incentive reduction

- **Observation:** G80 inventory rose 18.5% M/M to 1,270 units, but retail sales rose 36.8% M/M to 327; SOM increased 1.5pp versus a 1.0pp SOI gain, improving the availability-to-retail ratio to 0.86x. G80 incentive PNV fell 39.5% M/M and its incentive index fell 46.9 points to 163.7, which remains above the peer benchmark. [Evidence: operational_metrics.csv | G80 | National | 2026-08-01] [Evidence: cox_incentives.csv | G80 | National | 2026-08-01]
- **Interpretation:** **Fact** — G80 retail share currently exceeds its represented-segment inventory share, in contrast to the Genesis brand result. **Hypothesis** — G80's August retail strength may support selectively protecting availability or allocation before adding incentive support; the above-peer index is a reason to validate transaction response before expanding spend.
- **Implication:** Make G80 a targeted supply-and-price review: confirm whether low relative availability is limiting additional sales, and determine whether the remaining incentive premium is needed in the strongest-selling regions.
- **Evidence:** [Evidence: operational_metrics.csv | G80 | National | 2026-08-01] [Evidence: cox_incentives.csv | G80 | National | 2026-08-01]

### 5. The national imbalance is geographically concentrated in Southern and Western markets, not universal

- **Observation:** Southern had 11.7% SOI, 6.0% SOM, and a 1.94x ratio after inventory grew 9.4% M/M; Western had 6.2% SOI, 3.2% SOM, and the highest ratio at 1.97x. In contrast, Mountain States ran a 1.27x ratio and improved SOM by 0.4pp while inventory declined 6.0% M/M. [Evidence: operational_metrics.csv | Genesis | Southern | 2026-08-01] [Evidence: operational_metrics.csv | Genesis | Western | 2026-08-01] [Evidence: operational_metrics.csv | Genesis | Mountain States | 2026-08-01]
- **Interpretation:** **Fact** — excess availability versus retail share is concentrated most visibly in Southern and Western, while Mountain States is relatively tighter. **Hypothesis** — national measures may obscure an allocation and/or local conversion problem; the same vehicle supply plan should not be presumed appropriate across all regions.
- **Implication:** Use Southern and Western as the first two regional diagnostic markets for model mix, dealer concentration, local incentive execution, and marketing support. Avoid responding to their imbalance with a national action that could worsen availability in tighter regions.
- **Evidence:** [Evidence: operational_metrics.csv | Genesis | Southern, Western, Mountain States | 2026-08-01]

## Model-Level Analysis

### G70

- **Fact:** G70 ran 5.7% SOI versus 4.5% SOM (1.27x); August sales rose 6.7% M/M while inventory declined 1.9% M/M, but sales were down 24.6% Y/Y. Its $7,817 incentive PNV and 212.4 index are the highest Genesis national model values in the supplied Cox file. [Evidence: operational_metrics.csv | G70 | National | 2026-08-01] [Evidence: cox_incentives.csv | G70 | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Hypothesis** — the high relative incentive position is not yet translating into a clean availability-to-sales balance. Audit G70 incentive usage, retail mix, and competitor position before extending support; determine whether the Y/Y sales decline reflects segment demand, product mix, or execution. [Evidence: operational_metrics.csv | G70 | National | 2026-08-01] [Evidence: cox_incentives.csv | G70 | National | 2026-08-01]

### G80

- **Fact:** G80 is the only internal-combustion Genesis nameplate in the national model table with SOM above SOI (7.5% versus 6.5%, 0.86x), and sales grew faster than inventory M/M. [Evidence: operational_metrics.csv | G80 | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Hypothesis** — G80 warrants a regional availability check before demand generation is expanded. Its incentive index remains 163.7 despite the August reduction, so test whether incentives can be further localized rather than increased nationally. [Evidence: operational_metrics.csv | G80 | National | 2026-08-01] [Evidence: cox_incentives.csv | G80 | National | 2026-08-01]

### G90

- **Fact:** G90 held 8.4% SOI against 6.0% SOM (1.41x). Inventory declined 1.4% M/M and sales declined 5.2% M/M; sales were down 17.9% Y/Y while inventory was up 43.9% Y/Y. [Evidence: operational_metrics.csv | G90 | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Hypothesis** — the G90 imbalance is a longer-horizon inventory/product-positioning issue rather than an August supply surge. Its incentive index is below peer at 90.0; investigate trim, dealer, and regional mix before interpreting the low index as an opportunity to add discounting. [Evidence: operational_metrics.csv | G90 | National | 2026-08-01] [Evidence: cox_incentives.csv | G90 | National | 2026-08-01]

### GV60

- **Fact:** GV60 ran 9.9% SOI but 22.4% SOM (0.44x), while both inventory (-41.1% Y/Y) and retail sales (-41.5% Y/Y) declined materially. Incentive PNV fell 49.3% M/M to $5,252 and the index fell to 54.6. [Evidence: operational_metrics.csv | GV60 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV60 | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Hypothesis** — GV60's strong relative retail share is occurring against a shrinking absolute base, so its 0.44x ratio should not be read as proof of unconstrained growth. Validate whether retail demand is being supply-constrained, or whether both sales and inventory are contracting because of a planned product/availability shift. [Evidence: operational_metrics.csv | GV60 | National | 2026-08-01]

### GV70

- **Fact:** GV70 is balanced at 0.98x and is Genesis's largest inventory and sales contributor. Inventory was flat M/M, sales increased 6.7% M/M, and the incentive index moved to 83.2 after a 46.0-point M/M decline. [Evidence: operational_metrics.csv | GV70 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV70 | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Hypothesis** — maintain the current inventory stance while testing the endurance of the lower incentive position. Because GV70 has scale, a small deterioration in its ratio would materially affect the brand result; read the next month before changing its national program. [Evidence: operational_metrics.csv | GV70 | National | 2026-08-01]

### GV70 EV

- **Fact:** GV70 EV had 2.6% SOI versus 0.2% SOM, producing a 12.80x ratio. Inventory rose 522.2% M/M to 112 units and retail sales rose from a very small base to 68 units; both inventory and sales remain sharply down Y/Y. [Evidence: operational_metrics.csv | GV70 EV | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Investigation** — treat this as a volatile low-base signal, not a conventional availability diagnosis. Confirm data continuity, model-year flow, and sales reporting before acting; if confirmed, analyze dealer-level concentration and retail readiness for the new inventory.

### GV80

- **Fact:** GV80 had 7,693 average units, 4.5% SOI, 4.2% SOM, and a 1.09x ratio. Inventory increased 5.4% M/M while retail sales increased 14.1% M/M; its incentive index remains above peer at 107.6 after falling 29.2 points M/M. [Evidence: operational_metrics.csv | GV80 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV80 | National | 2026-08-01]
- **Opportunity / targeted investigation:** **Hypothesis** — GV80's August sales response was stronger than its inventory increase, but its 1.09x ratio and above-peer incentive level do not yet indicate a need for broader support. Segment the result by trim and region to identify whether the remaining imbalance is concentrated in specific price bands or dealers. [Evidence: operational_metrics.csv | GV80 | National | 2026-08-01] [Evidence: price_band_trim_allocation.csv | GV80 | National segment sample | 2026-08-01]

## Regional Dynamics

- **Fact:** Southern is the largest regional inventory pool at 6,215 units and combined a 9.4% M/M inventory increase with a 0.3pp decline in SOM; its 1.94x ratio indicates materially more availability than retail share. Eastern is also adding inventory (+15.0% M/M) and saw SOI rise 1.1pp while SOM declined 0.1pp. [Evidence: operational_metrics.csv | Genesis | Southern | 2026-08-01] [Evidence: operational_metrics.csv | Genesis | Eastern | 2026-08-01]
- **Fact / Hypothesis:** Western's 1.97x ratio is the highest of the seven regions even though inventory was down 1.9% M/M and SOM increased 0.5pp. This suggests that the Western mismatch predates August or is tied to mix rather than simply current-month inbound supply; compare model mix and dealer concentration with Southern before changing regional support. [Evidence: operational_metrics.csv | Genesis | Western | 2026-08-01] [Evidence: dealer_inventory.csv | Genesis dealers | Western DMA reference | 2026-08-01]

## Investigate Next

1. Does the brand-level 1.66x SOI/SOM ratio primarily originate in GV70/GV80 mix, or in the regional concentration seen in Southern and Western? Build a model-by-region matrix before changing national allocation. [Evidence: operational_metrics.csv | Genesis | National and regions | 2026-08-01]
2. For G70, why does the highest relative incentive position coexist with a 1.27x ratio and a 24.6% Y/Y retail-sales decline? Review program uptake, competitive transaction pricing, and dealer-level retail conversion. [Evidence: operational_metrics.csv | G70 | National | 2026-08-01] [Evidence: cox_incentives.csv | G70 | National | 2026-08-01]
3. For G80 and GV60, determine whether ratios below 1.00x reflect a genuine supply constraint or a contracting/volatile base. Required evidence: order flow, days-to-turn, model-year availability, and dealer-level sales. [Evidence: operational_metrics.csv | G80, GV60 | National | 2026-08-01]
4. Validate GV70 EV data continuity before interpreting its 12.80x ratio. Required evidence: model-year mapping, inventory feed completeness, dealer allocation dates, and sales reporting. [Evidence: operational_metrics.csv | GV70 EV | National | 2026-08-01]
