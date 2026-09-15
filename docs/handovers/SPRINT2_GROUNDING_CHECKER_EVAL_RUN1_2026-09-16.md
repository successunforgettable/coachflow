# Grounding checker — live eval (run1)

- fixtures: 7 whole scripts × 3 runs = 21 checked assets; model calls: 21
- models answering: claude-sonnet-4-6
- statuses: checked 21

## Per class

| class | measure | result |
|---|---|---|
| F2 specific biography | recall (expected ungrounded items found) | 18/18 = 100.0% |
| F2 specific biography | precision (flagged claims matching an expected item) | 25/28 = 89.3% |
| F2 grounding | expected grounded items grounded | 9/9 = 100.0% |
| F5 viewer finance | recall | 9/9 = 100.0% |
| F5 viewer finance | precision | 12/19 = 63.2% |
| F5 controls | control-line hits (idiom / third-person / conditional / general) | 7 |
| D-c | runs with zero flagged specific biography and ≥1 not_checkable | 3/3 = 100.0% |
| conflicts | detected | 3/3 = 100.0% · false positives 0 |
| certainty | overstated detected | 3/3 = 100.0% · false positives 0 |
| certainty | grounded-without-marker control kept grounded | 3/3 = 100.0% |

## Extraction errors

| callErrors | malformedResponses | unverifiedClaimQuotes | unverifiedFinancialQuotes | unverifiedBeatQuotes | responsesWithoutBeats | total |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 | 0 |

- assets needing a re-extraction: 0 of 21

## Latency and tokens (per model call)

- latency: median 8254 ms · max 17565 ms · per asset wall median 8254 ms
- input tokens: mean 2206 · max 2412
- output tokens: mean 673 · max 1017

## Per fixture, per run

| fixture | run | status | bio found | bio FP | grounded | conflicts | overstated | F5 found | F5 FP | not_checkable | D-c | calls | ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| certainty | 1 | checked | 0/0 | 0 | 0/0 | 0/0 | 1/1 | 0/0 | 0 | 0 | - | 1 | 6292 |
| certainty | 2 | checked | 0/0 | 0 | 0/0 | 0/0 | 1/1 | 0/0 | 0 | 0 | - | 1 | 6444 |
| certainty | 3 | checked | 0/0 | 0 | 0/0 | 0/0 | 1/1 | 0/0 | 0 | 0 | - | 1 | 6530 |
| conflict-countries | 1 | checked | 0/0 | 0 | 1/1 | 1/1 | 0/0 | 0/0 | 0 | 0 | - | 1 | 5674 |
| conflict-countries | 2 | checked | 0/0 | 0 | 1/1 | 1/1 | 0/0 | 0/0 | 0 | 1 | - | 1 | 6819 |
| conflict-countries | 3 | checked | 0/0 | 0 | 1/1 | 1/1 | 0/0 | 0/0 | 0 | 0 | - | 1 | 5691 |
| dc-control | 1 | checked | 0/0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 2 | pass | 1 | 6691 |
| dc-control | 2 | checked | 0/0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 2 | pass | 1 | 6969 |
| dc-control | 3 | checked | 0/0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 2 | pass | 1 | 6731 |
| f5-controls | 1 | checked | 0/0 | 0 | 0/0 | 0/0 | 0/0 | 3/3 | 0 | 0 | - | 1 | 6761 |
| f5-controls | 2 | checked | 0/0 | 0 | 0/0 | 0/0 | 0/0 | 3/3 | 1 | 0 | - | 1 | 8254 |
| f5-controls | 3 | checked | 0/0 | 0 | 0/0 | 0/0 | 0/0 | 3/3 | 0 | 0 | - | 1 | 8717 |
| k225-s229 | 1 | checked | 4/4 | 1 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 0 | - | 1 | 17566 |
| k225-s229 | 2 | checked | 4/4 | 1 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 0 | - | 1 | 16053 |
| k225-s229 | 3 | checked | 4/4 | 1 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 0 | - | 1 | 17320 |
| p1-with-facts | 1 | checked | 0/0 | 0 | 2/2 | 0/0 | 0/0 | 0/0 | 1 | 0 | - | 1 | 14823 |
| p1-with-facts | 2 | checked | 0/0 | 0 | 2/2 | 0/0 | 0/0 | 0/0 | 1 | 2 | - | 1 | 11146 |
| p1-with-facts | 3 | checked | 0/0 | 0 | 2/2 | 0/0 | 0/0 | 0/0 | 1 | 2 | - | 1 | 11927 |
| p1-without-facts | 1 | checked | 2/2 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 1 | 2 | - | 1 | 11677 |
| p1-without-facts | 2 | checked | 2/2 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 1 | 0 | - | 1 | 11512 |
| p1-without-facts | 3 | checked | 2/2 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 1 | 2 | - | 1 | 11539 |

## F2 biography false positives (fixture text, quoted for humans)

- k225-s229 run 1: "So I built a forensic process — Career Layer Excavation — that separates the expertise you have from the professional identity corporate trained you to perform."
- k225-s229 run 2: "finally ready to launch the consulting business"
- k225-s229 run 3: "finally ready to launch the consulting business"

## F5 false positives

- f5-controls run 2: "If you're earning well and want a plan for it, this session is for you."
- p1-with-facts run 1: "Nobody's building a pension behind a salary any more."
- p1-with-facts run 2: "Nobody's building a pension behind a salary any more."
- p1-with-facts run 3: "Nobody's building a pension behind a salary any more."
- p1-without-facts run 1: "Nobody's building a pension behind a salary any more."
- p1-without-facts run 2: "Nobody's building a pension behind a salary any more."
- p1-without-facts run 3: "Nobody's building a pension behind a salary any more."

## Conflict false positives

none

## Overstated false positives

none

## Misses (by first anchor)

none
