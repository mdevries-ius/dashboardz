I can’t write files in this interface. Below is the content for `04_supervisor_final.md`.

# Genesis Monthly Executive Insights

## Method and Limitations
- Reporting month: **Fact — August 2026** (`2026-08-01`). Changes are month over month unless labeled YoY. [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01]
- Competitive universe: Per the data contract, SOI and SOM use the aligned **Genesis competitive-segment universe—not the total luxury category**, notwithstanding the operational brand row’s “Luxury Market” label. Retain supplied operational SOI/SOM; use Cox and CloudTheory peer benchmarks separately. [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01]
- Data coverage and material caveats:
  - **Fact —** Operational model market-inventory denominators total 343,913 versus 277,351 at brand level, while model market-retail denominators reconcile to 141,919. This prevents a defensible model-level attribution of the brand ratio without an aggregation bridge; it does not establish that the supplied ratio is wrong. [Evidence: operational_metrics.csv | Genesis and all seven operational models | National | 2026-08-01]
  - **Fact —** Cross-file benchmarks differ materially: GV60 inventory share is 9.86% operationally versus 79.41% in the CloudTheory peer table. Listed trim coverage is incomplete—for example, G70 covers 2,440 inventory units versus 2,782 operationally. [Evidence: operational_metrics.csv | GV60 and G70 | National | 2026-08-01] [Evidence: cloudtheory_segment_metrics.csv | gv60 | National | 2026-08-01] [Evidence: price_band_trim_allocation.csv | g70 | National | 2026-08-01]
  - **Fact —** Incentive observations are national, without a separate GV70 EV row. Regional incentive effects cannot be established from this extract. [Evidence: cox_incentives.csv | Genesis model coverage | National | 2026-08-01]
  - **Investigation —** Treat SOI/SOM as relative availability, not days’ supply or a stock-cut target. Keep MSRP, advertised price and incentive PNV distinct. Require dealer-location, aging, transaction and response-model evidence before prescribing transfers or precise inventory/incentive changes.
  - Method: Prioritize connected internal signals and decision-changing comparisons. Coincident sales and incentive movements do not identify causality. No external context is used.

## Executive Summary

1. **The retail rebound does not justify broad inventory expansion—or a blanket stock cut**
   - **Observation:** **Fact —** Genesis retail rose 11.0% to 6,490 while inventory rose 3.0% to 21,064. Nevertheless, SOI increased 0.453 percentage points to 7.59%, versus SOM’s 0.138-point increase to 4.57%, worsening SOI/SOM to 1.66x. YoY, inventory rose 5.2% while retail fell 10.6%. [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01]
   - **Interpretation:** **Hypothesis —** Absolute recovery is masking a continuing competitive-availability imbalance. Segment composition and competitive-market movements may contribute alongside Genesis execution; the aggregate ratio cannot identify which stock is unproductive.
   - **Implication:** **Investigation —** Use the brand ratio as a warning indicator, not an allocation formula. Gate national supply changes on denominator reconciliation and model-region sellable-stock evidence.
   - **Confidence:** High
   - **Evidence:** **Fact —** Genesis’s 1.66x exceeds BMW’s 1.38x, Mercedes-Benz’s 1.35x, Audi’s 1.19x and Lexus’s 0.70x. The rebound also coincided with incentive PNV falling 25.7% to $5,412, still above benchmark at index 115.3; higher headline support is not the observed explanation. [Evidence: competitor_efficiency.csv | Genesis, BMW, Mercedes-Benz, Audi and Lexus | National | 2026-08-01] [Evidence: cox_incentives.csv | Genesis | National | 2026-08-01]

2. **Southern is the first allocation-control priority; Western needs a different response**
   - **Observation:** **Fact —** Southern inventory rose 9.4% versus retail growth of 6.4%; SOM fell 0.266 points and SOI/SOM worsened to 1.94x. Eastern inventory rose 15.0% versus retail growth of 7.3%, also losing SOM. Together, these regions added approximately 1,041 average inventory units against a national net increase of approximately 615, derived from supplied growth rates. [Evidence: operational_metrics.csv | Genesis | Southern | 2026-08-01] [Evidence: operational_metrics.csv | Genesis | Eastern | 2026-08-01] [Evidence: operational_metrics.csv | Genesis | National | 2026-08-01]
   - **Interpretation:** **Hypothesis —** Incoming inventory is concentrated where relative retail performance is weakening. Southern warrants tighter receipt and conversion scrutiny; Eastern requires model-level discrimination rather than a uniform reduction.
   - **Implication:** **Investigation —** Review Southern/Eastern incoming supply and aged stock first. Screen—not automatically execute—demand-matched transfers. Do not treat Western’s improving trajectory as proof it needs additional stock.
   - **Confidence:** High
   - **Evidence:** **Fact —** Western retail rose 22.9%, inventory fell 1.9%, and SOI/SOM improved 0.304x, but its ending 1.97x remained above all four supplied local peers. Southern’s 1.94x likewise exceeded its peers, including Mercedes-Benz at 1.45x and Lexus at 0.58x. [Evidence: operational_metrics.csv | Genesis | Western | 2026-08-01] [Evidence: competitor_efficiency.csv | Genesis, BMW, Mercedes-Benz, Audi and Lexus | Western | 2026-08-01] [Evidence: competitor_efficiency.csv | Genesis, Mercedes-Benz and Lexus | Southern | 2026-08-01]

3. **Protect GV70 and G80’s productive availability; do not extrapolate their incentive reductions**
   - **Observation:** **Fact —** GV70 retail rose 6.7% with inventory down 0.2%, improving SOI/SOM to 0.983x as incentive PNV fell 39.0%. G80 retail rose 36.8% against inventory growth of 18.5%, improving its ratio to 0.862x as PNV fell 39.5%. [Evidence: operational_metrics.csv | GV70 and G80 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV70 and G80 | National | 2026-08-01]
   - **Interpretation:** **Hypothesis —** These are the strongest candidates for preserving productive availability without automatically restoring prior support. Delivery timing, program carryover or mix could explain some resilience; lower incentives have not been shown to cause growth or protect margin.
   - **Implication:** **Investigation —** Test sustained conversion within matched model-year/trim cohorts before further incentive changes. Validate orders and lost sales before selective replenishment.
   - **Confidence:** Medium
   - **Evidence:** **Fact —** GV70 PNV of $3,662 sits between BMW X3’s $6,443 and Mercedes-Benz GLC’s $2,407. G80 remains substantially above its segment incentive benchmark at index 163.7 versus BMW 5 Series at 71.6. These models therefore do not represent the same support posture. [Evidence: cox_segment_incentives.csv | genesis_gv70, bmw_x3, mercedes_benz_glc, genesis_g80 and bmw_5_series | National | 2026-08-01]

4. **G70 needs a conversion-and-assortment diagnosis before more broad support**
   - **Observation:** **Fact —** G70 PNV rose 98.1% YoY to $7,817 while retail fell 24.6% and SOM lost 1.238 points. Inventory declined only 7.5%, worsening SOI/SOM YoY to 1.269x despite an operational MSRP index of 90.6. [Evidence: cox_incentives.csv | G70 | National | 2026-08-01] [Evidence: operational_metrics.csv | G70 | National | 2026-08-01]
   - **Interpretation:** **Hypothesis —** Insufficient headline discounting is not the best-supported default diagnosis. Configuration fit, effective payments, model-year exposure or shopper conversion may be limiting results.
   - **Implication:** **Investigation —** Prioritize aged-stock and funnel diagnostics before a national incentive increase. Test targeted offers or entry-price merchandising against matched controls rather than assuming additional spend is incremental.
   - **Confidence:** Medium
   - **Evidence:** **Fact —** G70 has the highest PNV among supplied near-luxury-car peers, exceeding BMW 3 Series at $6,900. Approximately 71% of covered trim inventory is 3.3T; the two large Sport Prestige rows contain 1,492 units at approximately $56,300–$56,500 advertised, versus approximately $46,321 for the listed 2.5T RWD row. This establishes assortment concentration, not customer preference or historical mix change. [Evidence: cox_segment_incentives.csv | genesis_g70 and near luxury car peers | National | 2026-08-01] [Evidence: price_band_trim_allocation.csv | g70 | National | 2026-08-01]

5. **GV80’s rebound calls for regional and trim precision—not a national price reset**
   - **Observation:** **Fact —** GV80 retail rose 14.1% while inventory rose 5.4%, but SOI gained 0.543 points against SOM’s 0.207-point gain, worsening SOI/SOM to 1.088x. Weighted MSRP fell 1.0% and incentive PNV fell 25.2%. Southern ended at 1.385x versus Mountain States at 0.711x. [Evidence: operational_metrics.csv | GV80 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV80 | National | 2026-08-01] [Evidence: operational_metrics.csv | GV80 | Southern | 2026-08-01] [Evidence: operational_metrics.csv | GV80 | Mountain States | 2026-08-01]
   - **Interpretation:** **Hypothesis —** The recovery coexists with localized availability risk. Neither falling weighted MSRP nor a broad segment premium establishes a need for across-the-board discounting.
   - **Implication:** **Investigation —** Audit regional trim aging, receipts and customer demand before changing national price support. Do not assume nationally concentrated premium configurations are located in Southern.
   - **Confidence:** Medium
   - **Evidence:** **Fact —** GV80 weighted MSRP is $79,634, below BMW X5’s $87,101 but above Lexus RX’s $64,879; corresponding incentive PNV is $6,382, $10,462 and $1,686. Separately, the national Prestige Signature trim row contains 1,748 units at $83,774 advertised. Competitive positioning and trim concentration warrant investigation, not a constructed net-price comparison. [Evidence: cloudtheory_segment_metrics.csv | gv80, x5 and rx | National | 2026-08-01] [Evidence: cox_segment_incentives.csv | genesis_gv80, bmw_x5 and lexus_rx | National | 2026-08-01] [Evidence: price_band_trim_allocation.csv | gv80 | National | 2026-08-01]

## Model-Level Dynamics

### G70
- **Fact —** Eastern retail fell 8.8% while weighted MSRP fell 1.2%, worsening SOI/SOM to 1.401x. Mountain States instead increased retail 29.2% with inventory down 3.4%, ending at 0.805x. [Evidence: operational_metrics.csv | G70 | Eastern | 2026-08-01] [Evidence: operational_metrics.csv | G70 | Mountain States | 2026-08-01]
- **Investigation —** Compare regional configuration availability, model years, realized payments and lost-sale reasons; national incentive intensity does not explain this divergence.

### G80
- **Fact —** Eastern retail rose 55.6% with inventory up 41.2%; Western retail fell 8.3% with inventory up 25.8%. The national recovery is not geographically uniform. [Evidence: operational_metrics.csv | G80 | Eastern | 2026-08-01] [Evidence: operational_metrics.csv | G80 | Western | 2026-08-01]
- **Investigation —** Audit Western receipts and conversion before increasing broad allocation; validate whether Eastern replenishment is supporting sustained demand.

### G90
- **Fact —** Inventory rose 43.9% YoY while retail fell 17.9%, taking SOI/SOM to 1.406x despite an operational MSRP index of 80.05. Mid-Atlantic ended at 2.307x on only eight retail sales. [Evidence: operational_metrics.csv | G90 | National | 2026-08-01] [Evidence: operational_metrics.csv | G90 | Mid-Atlantic | 2026-08-01]
- **Investigation —** Prioritize aging, configuration fit and client appointment conversion. Use order-led allocation evidence rather than interpreting the broad MSRP discount as proof of customer value or the small regional sample as a stable demand rate.

### GV60
- **Fact —** Retail fell 7.4% while inventory rose 4.5%, worsening SOI/SOM to 0.441x as PNV fell 49.3%. YoY retail fell 41.5%, yet SOM increased 5.305 points—share resilience without volume resilience. [Evidence: operational_metrics.csv | GV60 | National | 2026-08-01] [Evidence: cox_incentives.csv | GV60 | National | 2026-08-01]
- **Investigation —** Validate local orders and effective offers before replenishment. Do not infer scarcity from the low ratio or incentive causality from monthly softness.

### GV70
- **Fact —** Southern inventory rose 10.9% while retail fell 2.2%; South Central inventory fell 12.5% while retail rose 29.6%, ending at 0.812x SOI/SOM. [Evidence: operational_metrics.csv | GV70 | Southern | 2026-08-01] [Evidence: operational_metrics.csv | GV70 | South Central | 2026-08-01]
- **Investigation —** Assess Southern stock fit against verified South Central orders before adding national supply or escalating offers.

### GV70 EV
- **Fact —** Sales recovered from an implied seven to 68 and inventory from 18 to 112, but SOI/SOM remained 12.804x. Its operational competitive market reports 4,258 inventory units against 33,100 monthly retail sales; CloudTheory separately lists only one Model Y inventory unit. [Evidence: operational_metrics.csv | GV70 EV | National | 2026-08-01] [Evidence: cloudtheory_segment_metrics.csv | model_y | National | 2026-08-01]
- **Investigation —** Audit competitor/channel inventory visibility before interpreting the extreme ratio as physical overstock. Obtain separate incentive exposure and sellable-stock records; do not borrow GV70’s incentive diagnosis.

### GV80
- **Fact —** YoY PNV rose 54.7%, but its incentive index fell 1.32 points while retail declined 3.9% and SOM lost 0.414 points. Greater dollar support did not mean greater benchmark-relative support or share retention. [Evidence: cox_incentives.csv | GV80 | National | 2026-08-01] [Evidence: operational_metrics.csv | GV80 | National | 2026-08-01]
- **Investigation —** Track trim-level contribution and regional share recovery, separating within-trim pricing from inventory-weight changes.

### GV80 Coupe
- **Fact —** The trim extract identifies 719 Coupe inventory units, but no separate operational performance row. Its independent retail efficiency cannot be diagnosed. [Evidence: price_band_trim_allocation.csv | gv80_coupe | National | 2026-08-01] [Evidence: operational_metrics.csv | Genesis model coverage | National | 2026-08-01]
- **Investigation —** Confirm mapping into GV80 and obtain separate sales, age and incentive measures before attributing GV80’s premium mix or ratio movement to Coupe.

## Regional Dynamics
- **Fact — Central:** Inventory fell 3.9% and retail rose 2.5%, yet SOM fell 0.089 points and SOI/SOM remained 1.493x. **Investigation —** Separate inventory normalization from competitive demand recovery. [Evidence: operational_metrics.csv | Genesis | Central | 2026-08-01]
- **Fact — Mid-Atlantic:** Inventory rose 41.4% YoY while retail fell 13.3%; SOI/SOM reached 1.691x, above all four supplied local peers. **Investigation —** Review receipts, rich configuration exposure and aged stock rather than adding broad supply. [Evidence: operational_metrics.csv | Genesis | Mid-Atlantic | 2026-08-01] [Evidence: competitor_efficiency.csv | Genesis, BMW, Mercedes-Benz, Audi and Lexus | Mid-Atlantic | 2026-08-01]
- **Fact — Mountain States:** Retail rose 15.7% with inventory down 6.0%, lifting SOM 0.404 points and reducing SOI/SOM to 1.273x—below BMW, Audi and Mercedes-Benz, but above Lexus. **Investigation —** Validate replicable dealer practices and unmet demand separately. [Evidence: operational_metrics.csv | Genesis | Mountain States | 2026-08-01] [Evidence: competitor_efficiency.csv | Genesis, BMW, Mercedes-Benz, Audi and Lexus | Mountain States | 2026-08-01]
- **Fact — South Central:** Retail rose 24.4% and inventory fell 5.6%, yet brand SOM declined 0.314 points while GV70 model SOM gained 2.013 points. **Investigation —** Reconcile segment composition and market growth before declaring broad competitive success. [Evidence: operational_metrics.csv | Genesis and GV70 | South Central | 2026-08-01]
- **Investigation — Southern, Eastern and Western:** Apply the differentiated allocation and model controls above. Avoid converting regional brand ratios directly into transfer quantities.

## Investigate Next
1. **Question:** **Investigation —** Can brand/model and EV competitive denominators be reconciled?
   - **Why it could change a decision:** Determines whether aggregate and EV ratio signals support allocation action or mainly require a coverage adjustment.
   - **Missing evidence:** Segment/member crosswalks, deduplication rules, inventory/retail channel inclusion, listing visibility and prior-period denominator bridges.

2. **Question:** **Investigation —** Would demand-matched SUV reallocation outperform local offers?
   - **Why it could change a decision:** Distinguishes a location problem from weak underlying demand and tests the economics of transfers.
   - **Missing evidence:** Dealer locations, VIN age, sellable/in-transit status, regional trim retail, destination orders, registration geography, transport cost and contribution.

3. **Question:** **Investigation —** What constrains G70 despite its current support?
   - **Why it could change a decision:** Separates configuration or execution remedies from genuinely incremental incentive spending.
   - **Missing evidence:** Model-year/trim sales, realized incentive eligibility, lease payments, dealer discounts, funnel conversion, lost-sale reasons and controlled offer tests.

4. **Question:** **Investigation —** Are GV70 and G80 retaining comparable-cohort demand under lower support?
   - **Why it could change a decision:** Establishes whether current support can be sustained without weakening future conversion.
   - **Missing evidence:** Contract versus delivery dates, program carryover, matched trim/model-year cohorts, cancellations, orders and realized contribution.

5. **Question:** **Investigation —** Are premium configurations earning their inventory allocation?
   - **Why it could change a decision:** Separates profitable premium mix from slow-moving capital exposure before changing assortment or price.
   - **Missing evidence:** Complete historical trim coverage, within-trim advertised-price changes, retail mix, aging, gross profit, demonstrator status and Coupe mapping.
