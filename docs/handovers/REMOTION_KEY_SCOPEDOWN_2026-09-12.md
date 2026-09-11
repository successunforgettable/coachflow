# REMOTION AWS KEY SCOPE-DOWN — 2026-09-12

**Authority:** Arfeen, 2026-09-12 — "scope down the Remotion AWS key … restrict its policy to read/write access on
the Remotion render bucket only, nothing else … confirm Remotion can still render normally, and confirm separately
that the key can no longer list or access any other bucket."

## 1. THE KEY

- **One IAM user holds it:** `arn:aws:iam::418272787500:user/zap-remotion`, key `AKIA…725H` (created 2026-03-27,
  the user's only key). **Railway's `AWS_ACCESS_KEY_ID` and `REMOTION_AWS_ACCESS_KEY_ID` are the SAME key.**
- **What ZAP calls with it:** only `renderMediaOnLambda` and `getRenderProgress` (`server/lib/remotionRenderer.ts`),
  reached from `server/routers/videos.ts`. No other AWS SDK client exists in `server/`.
- **The render function:** `remotion-render-4-0-441-mem2048mb-disk2048mb-240sec` (us-east-1), running under its OWN
  execution role `remotion-lambda-role` — the role does the S3 writes during a render and is NOT changed here.

## 2. BEFORE — measured 2026-09-12, before any change

**Attached to `zap-remotion`** (no inline policies, no groups, no permissions boundary):

| policy | what it grants |
|---|---|
| **`IAMFullAccess`** (AWS-managed) | `iam:*` — the key could grant itself anything, including admin |
| **`AmazonS3FullAccess`** (AWS-managed) | `s3:*` and `s3-object-lambda:*` on **every** bucket |
| **`AWSLambda_FullAccess`** (AWS-managed) | every Lambda function in the account, plus related reads |
| **`CloudWatchLogsFullAccess`** (AWS-managed) | `logs:*` on every log group |
| `remotion-lambda-policy` (customer) | `s3:ListAllMyBuckets` on `*` · S3 on `remotionlambda-*` · invoke `remotion-render-*` · Remotion log groups |

**Bucket reach — every bucket on the account.** `list` is a live `ListObjectsV2`; Get/Put/Delete are
`iam:SimulatePrincipalPolicy` decisions on `arn:aws:s3:::<bucket>/*` (nothing was written):

| bucket | region | list | GetObject | PutObject | DeleteObject |
|---|---|---|---|---|---|
| `04-11-24-arfeenkhan.com` | ap-south-1 | ALLOWED | allowed | allowed | allowed |
| `arfeenkhan.com` | ap-south-1 | ALLOWED | allowed | allowed | allowed |
| `arfeenkhans3` | ap-south-1 | ALLOWED | allowed | allowed | allowed |
| `cf-templates-xk50msloabfl-ap-southeast-1` | ap-southeast-1 | ALLOWED | allowed | allowed | allowed |
| `dropbox-video-backup` | us-east-1 | ALLOWED | allowed | allowed | allowed |
| `innerdna` | ap-south-1 | ALLOWED | allowed | allowed | allowed |
| `masterminds-staging-discourse-backups` | ap-south-1 | ALLOWED | allowed | allowed | allowed |
| `remotionlambda-useast1-am9lni57ts` | us-east-1 | ALLOWED | allowed | allowed | allowed |
| `test-8828` | ap-south-1 | ALLOWED | allowed | allowed | allowed |

**All 9 buckets: list, read, write, delete.** Plus, through `IAMFullAccess`, the power to change any of that.

## 3. THE TARGET — `zap-remotion-render-only`

- **S3, the Remotion bucket only:** `s3:ListBucket`, `s3:GetBucketLocation` on
  `arn:aws:s3:::remotionlambda-useast1-am9lni57ts`; `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`,
  `s3:PutObjectAcl` on `arn:aws:s3:::remotionlambda-useast1-am9lni57ts/*`.
- **The render function only:** `lambda:InvokeFunction`, `lambda:InvokeAsync`, `lambda:GetFunction` on the one
  function ARN. **The one reading taken, stated:** "bucket only, nothing else" read literally would leave the key
  unable to invoke the render function, and "Remotion can still render normally" could not hold — so the key keeps
  exactly that one non-S3 permission, scoped to the one function.
- **Removed entirely:** `s3:ListAllMyBuckets`, every other bucket, every other Lambda function, all logs, **and all
  IAM** — an S3 restriction the key could undo with `iam:*` would be decoration (§15c).
- **Consequence:** deploying a NEW Remotion function or site version (`npx remotion lambda functions deploy`,
  `sites create`) now needs a separate, broader credential. The running product does not.

## 4. RESULTS — every check a live call, not the policy write

**Method.** The same two probes ran three times: BEFORE any change (the positive control — it must be able to SEE
access, or a later "denied" means nothing), after PHASE 1 (new policy attached, S3/Lambda/Logs full access and
`remotion-lambda-policy` detached, `IAMFullAccess` still attached as the safety net so any mistake could be undone),
and after PHASE 2 (`IAMFullAccess` detached — the last step). The access probe: `ListBuckets`, then per bucket a live
`ListObjectsV2` and a `GetObject` of a key that cannot exist (allowed → `NoSuchKey`; denied → `AccessDenied`; reads
nothing, writes nothing). The render probe: ZAP's own `triggerRemotionRender` + `pollRemotionRender`, a fetch of the
output, then deletion of the test render from the bucket.

| check | BEFORE (21:15 UTC) | after PHASE 1 (21:17) | after PHASE 2 (21:19) — final |
|---|---|---|---|
| list all bucket names | ALLOWED (9) | **DENIED** | **DENIED** |
| the 8 other buckets — list | ALLOWED ×8 | **DENIED ×8** (`AccessDenied`) | **DENIED ×8** |
| the 8 other buckets — read | ALLOWED ×8 (`NoSuchKey`) | **DENIED ×8** (`AccessDenied`) | **DENIED ×8** |
| Remotion bucket — list / read | ALLOWED / ALLOWED | ALLOWED / ALLOWED | **ALLOWED / ALLOWED** |
| **real render** | 27 s → HTTP 200 `video/mp4` 1,417,203 B | 12 s → HTTP 200 `video/mp4` 1,417,203 B | **13 s → HTTP 200 `video/mp4` 1,417,203 B** |
| test render deleted from the bucket | 2/2 | 2/2 | **2/2** |
| IAM (`ListAttachedUserPolicies`, `ListUsers`, `ListRoles`) | allowed | allowed (safety net) | **DENIED ×3** |

IAM simulation after phase 1 agreed: Get/Put/Delete and ListBucket `implicitDeny` on all 8 other buckets and
`allowed` only on the Remotion bucket; `ListAllMyBuckets` `implicitDeny`; invoke the render function `allowed`,
any other function `implicitDeny`.

**Final state of `zap-remotion`:** exactly one policy, `zap-remotion-render-only`. The detached policies still exist
in the account (only detached, nothing deleted), so a rollback is an attach by an account admin.

**Not changed:** the render function, its execution role `remotion-lambda-role`, the Railway variables, any bucket.
**Now needs a separate admin credential:** deploying a new Remotion function or site version, and any further IAM
change to this user — the key can no longer change its own permissions.
