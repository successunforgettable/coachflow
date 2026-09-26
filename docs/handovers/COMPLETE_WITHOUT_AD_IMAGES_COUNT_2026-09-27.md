# Campaigns marked complete without ad images — production count, 2026-09-27

Read only: a READ ONLY transaction whose target reported `MySQL Community Server - GPL`, database `railway`.
Measured at run time.

| measure | value |
|---|---|
| campaignKits total | **22** (ids 187–225) |
| status `complete` | **7** |
| status `draft` | 15 |
| status `exported` | 0 |
| `complete` or `exported` with no `selectedAdCreativeBatchId` (NULL or '') | **0** |
| `complete` or `exported` whose batch pointer resolves to no `adCreatives` row with an image | **0** |
| `complete` whose batch resolves to at least one image (positive control) | **7** — every complete kit |

**Result: 0.** No campaign on production today is marked complete without ad images.

The defect in COMPLETION_AND_FIRST_DEPLOY_PROPOSAL Part 1 §1.2 item 3 is still real in the code: `updateSelection`
marks a kit `complete` while ignoring ad images. It has simply produced no such kit yet.

Note: the 2026-08-29 baseline recorded 68–69 kits. Today's 22 is lower. This count does not explain the difference.
