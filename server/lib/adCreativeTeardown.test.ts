/**
 * adCreativeTeardown.test.ts — the teardown guard.
 *
 * WHY THIS SUITE EXISTS. `sweepAdCreativeBatch` was scoped by `batchId` ALONE — the file
 * carried zero references to userId — while the standing rule is that teardown is always
 * id-scoped AND userId-guarded. Smoke user 117174 OWNS the 25 protected creatives on
 * services 272-277, so a mis-scoped sweep is the one mistake here that cannot be undone:
 * deleting the rows makes their Cloudinary URLs unrecoverable and the images stay hosted
 * forever with no way to find them.
 *
 * The image sprint renders real Cloudinary objects, so this had to land before anything
 * in that sprint tears down.
 *
 * These use a fake db that RECORDS the scope it was handed, so the assertions are about
 * what the helper actually asks the database to do — not about what its comments claim.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../storage", () => ({
  storageDelete: vi.fn(async () => {}),
}));

import {
  sweepAdCreativeBatch,
  publicIdFromUrl,
  ProtectedServiceError,
  PROTECTED_SERVICE_IDS,
} from "./adCreativeTeardown";
import { storageDelete } from "../storage";

type Row = { id: number; serviceId: number | null; imageUrl: string | null; rawImageUrl: string | null };

/**
 * Minimal Drizzle-shaped fake. It records every `where(...)` it is given so a test can
 * assert the delete was scoped, and returns rows only when the caller's scope matches the
 * row's (batchId, userId) — which is what makes the "mismatched userId deletes nothing"
 * test meaningful rather than tautological.
 */
function fakeDb(rows: Row[], rowKey: { batchId: string; userId: number }) {
  const calls = { selectWheres: 0, deleteWheres: 0, deleted: false, deleteScopeSeen: null as any };
  let pendingScope: any = null;

  const matches = (scope: any) =>
    scope?.__batchId === rowKey.batchId && scope?.__userId === rowKey.userId;

  const db: any = {
    select: () => ({
      from: () => ({
        where: (scope: any) => {
          calls.selectWheres += 1;
          pendingScope = scope;
          return matches(scope) ? rows : [];
        },
      }),
    }),
    delete: () => ({
      where: (scope: any) => {
        calls.deleteWheres += 1;
        calls.deleteScopeSeen = scope;
        if (!matches(scope)) return { affectedRows: 0 };
        calls.deleted = true;
        return { affectedRows: rows.length };
      },
    }),
  };
  return { db, calls };
}

// `and(eq(batchId), eq(userId))` is opaque at runtime, so the schema columns are stubbed to
// produce a scope object the fake can read. This mirrors the real call shape exactly.
vi.mock("drizzle-orm", () => ({
  and: (...parts: any[]) => Object.assign({}, ...parts),
  eq: (col: any, val: any) => ({ [`__${col.__name}`]: val }),
}));
vi.mock("../../drizzle/schema", () => ({
  adCreatives: {
    id: { __name: "id" },
    userId: { __name: "userId" },
    serviceId: { __name: "serviceId" },
    batchId: { __name: "batchId" },
    imageUrl: { __name: "imageUrl" },
    rawImageUrl: { __name: "rawImageUrl" },
    sourceImageUrl: { __name: "sourceImageUrl" },
  },
}));

const URL_A = "https://res.cloudinary.com/x/image/upload/v1785333244/ad-creatives/1/b/variation-1.png.png";
const URL_RAW_A = "https://res.cloudinary.com/x/image/upload/v1785333244/ad-creatives/1/b/raw-variation-1.png.png";

const row = (over: Partial<Row> = {}): Row => ({
  id: 1, serviceId: 900, imageUrl: URL_A, rawImageUrl: URL_RAW_A, ...over,
});

beforeEach(() => { vi.mocked(storageDelete).mockClear(); });

describe("userId guard", () => {
  it("sweeps normally when batchId AND userId both match", async () => {
    const { db, calls } = fakeDb([row()], { batchId: "b1", userId: 117174 });
    const res = await sweepAdCreativeBatch(db, "b1", 117174);
    expect(res.rowsFound).toBe(1);
    expect(res.rowsDeleted).toBe(1);
    expect(calls.deleted).toBe(true);
    expect(res.userId).toBe(117174);
  });

  it("🔴 a MISMATCHED userId finds nothing and DELETES NOTHING", async () => {
    const { db, calls } = fakeDb([row()], { batchId: "b1", userId: 117174 });
    const res = await sweepAdCreativeBatch(db, "b1", 999999);
    expect(res.rowsFound).toBe(0);
    expect(res.rowsDeleted).toBe(0);
    expect(calls.deleted).toBe(false);
    // and nothing was removed from Cloudinary either
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("carries the guard on the DELETE, not only on the read", async () => {
    // Guarding only the read would report the right rows and delete the wrong ones.
    const { db, calls } = fakeDb([row()], { batchId: "b1", userId: 117174 });
    await sweepAdCreativeBatch(db, "b1", 117174);
    expect(calls.deleteScopeSeen).toMatchObject({ __batchId: "b1", __userId: 117174 });
  });
});

describe("protected-service refusal — independent of the userId guard", () => {
  for (const sid of PROTECTED_SERVICE_IDS) {
    it(`throws before deleting anything when a row sits on service ${sid}`, async () => {
      const { db, calls } = fakeDb([row({ serviceId: sid })], { batchId: "b1", userId: 117174 });
      await expect(sweepAdCreativeBatch(db, "b1", 117174)).rejects.toThrow(ProtectedServiceError);
      expect(calls.deleted).toBe(false);
      expect(storageDelete).not.toHaveBeenCalled();
    });
  }

  it("🔴 refuses even when the userId guard PASSES — the smoke user owns protected rows", async () => {
    // This is the real scenario: user 117174 legitimately owns services 272-277, so the
    // guard alone cannot save them. A wrong-but-same-user batchId is exactly this case.
    const { db, calls } = fakeDb(
      [row({ id: 1, serviceId: 272 }), row({ id: 2, serviceId: 900 })],
      { batchId: "b1", userId: 117174 },
    );
    await expect(sweepAdCreativeBatch(db, "b1", 117174)).rejects.toThrow(/protected service/i);
    expect(calls.deleted).toBe(false);
  });

  it("refuses BEFORE Cloudinary, so no image is lost on a refused sweep", async () => {
    const { db } = fakeDb([row({ serviceId: 285 })], { batchId: "b1", userId: 117174 });
    await expect(sweepAdCreativeBatch(db, "b1", 117174)).rejects.toThrow();
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("names every protected service it found, so the message is actionable", async () => {
    const { db } = fakeDb(
      [row({ id: 1, serviceId: 277 }), row({ id: 2, serviceId: 272 })],
      { batchId: "b1", userId: 117174 },
    );
    await expect(sweepAdCreativeBatch(db, "b1", 117174)).rejects.toThrow(/272, 277/);
  });

  it("does not refuse on an ordinary service", async () => {
    const { db, calls } = fakeDb([row({ serviceId: 900 })], { batchId: "b1", userId: 117174 });
    await sweepAdCreativeBatch(db, "b1", 117174);
    expect(calls.deleted).toBe(true);
  });
});

describe("ordering and dry run — unchanged behaviour, still asserted", () => {
  it("dry run deletes nothing, in either store", async () => {
    const { db, calls } = fakeDb([row()], { batchId: "b1", userId: 117174 });
    const res = await sweepAdCreativeBatch(db, "b1", 117174, { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.publicIds.length).toBe(2);      // composited + raw
    expect(calls.deleted).toBe(false);
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("reads BOTH imageUrl and rawImageUrl — the raw+composited pair", async () => {
    const { db } = fakeDb([row()], { batchId: "b1", userId: 117174 });
    const res = await sweepAdCreativeBatch(db, "b1", 117174, { dryRun: true });
    expect(res.publicIds).toContain("ad-creatives/1/b/variation-1.png");
    expect(res.publicIds).toContain("ad-creatives/1/b/raw-variation-1.png");
  });

  it("clears Cloudinary BEFORE the rows go — the ids are unrecoverable afterwards", async () => {
    const order: string[] = [];
    vi.mocked(storageDelete).mockImplementation(async () => { order.push("cloudinary"); });
    const { db } = fakeDb([row()], { batchId: "b1", userId: 117174 });
    const realDelete = db.delete;
    db.delete = () => ({ where: (s: any) => { order.push("rows"); return realDelete().where(s); } });
    await sweepAdCreativeBatch(db, "b1", 117174);
    expect(order[order.length - 1]).toBe("rows");
    expect(order.filter((o) => o === "cloudinary").length).toBe(2);
  });
});

// ⚠️ THE ORIGINAL publicIdFromUrl SUITE, PRESERVED VERBATIM. The guard work above was
// added to this file and must not cost it its existing coverage — these five cases pin
// the `.png.png` double-suffix behaviour against real production URLs and are the reason
// the 2026-07-29 orphan recovery worked.
describe("publicIdFromUrl", () => {
  it("extracts the id from a real stored ad-creative URL, keeping the inner .png", () => {
    // Verbatim from prod, 2026-07-29. The `.png.png` is the known storage-key
    // double-suffix bug: the inner .png is part of the public_id, the outer is
    // Cloudinary's delivery extension.
    expect(publicIdFromUrl(
      "https://res.cloudinary.com/dunshei0y/image/upload/v1785333244/ad-creatives_117174_batch-1785333231628-37151b84_variation-1.png.png",
    )).toBe("ad-creatives_117174_batch-1785333231628-37151b84_variation-1.png");
  });

  it("handles the raw sibling", () => {
    expect(publicIdFromUrl(
      "https://res.cloudinary.com/dunshei0y/image/upload/v1785333244/ad-creatives_117174_batch-x_raw-variation-3.png.png",
    )).toBe("ad-creatives_117174_batch-x_raw-variation-3.png");
  });

  it("works without a version segment", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/folder_file.png"))
      .toBe("folder_file");
  });

  it("returns null for anything that is not a Cloudinary upload URL", () => {
    expect(publicIdFromUrl(null)).toBeNull();
    expect(publicIdFromUrl("")).toBeNull();
    expect(publicIdFromUrl("https://example.com/a.png")).toBeNull();
  });

  it("does not strip a non-media suffix", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/v1/a_b.tar.gz"))
      .toBe("a_b.tar.gz");
  });

  it("strips the delivery extension and keeps the key's own .png (path-style key)", () => {
    expect(publicIdFromUrl(URL_A)).toBe("ad-creatives/1/b/variation-1.png");
  });
});

/**
 * ─── Migration 0099: the THIRD Cloudinary object ────────────────────────────
 *
 * Every render uploads an intermediate `generated/…` object before the raw and
 * composited copies are stored on the row. Only the latter two were ever recorded,
 * so the sweep — which reads its ids off the row — cleared two of three and leaked
 * one per render, permanently. Measured on the 2026-08-08 proof run: four renders,
 * four orphans left behind after a sweep that reported itself clean.
 *
 * These cases are ADDITIVE. The suite above still pins the userId guard and the
 * protected-service refusal on rows that carry no `sourceImageUrl`, which is exactly
 * the legacy shape — so the pre-0099 behaviour stays covered rather than replaced.
 */
describe("sweepAdCreativeBatch — the intermediate render (migration 0099)", () => {
  const URL_SRC = "https://res.cloudinary.com/x/image/upload/v1786201235/generated/1786201235005-gd8k7rj.png.png";
  const B = { batchId: "batch-0099", userId: 117174 };

  it("sweeps THREE objects per row, not two", async () => {
    const rows = [{ ...row(), sourceImageUrl: URL_SRC } as any];
    const { db } = fakeDb(rows, B);
    const res = await sweepAdCreativeBatch(db, B.batchId, B.userId);

    expect(res.publicIds).toHaveLength(3);
    expect(res.cloudinaryDeleted).toBe(3);
    expect(res.cloudinaryFailed).toEqual([]);
  });

  it("includes the intermediate's public id specifically", async () => {
    const rows = [{ ...row(), sourceImageUrl: URL_SRC } as any];
    const { db } = fakeDb(rows, B);
    const res = await sweepAdCreativeBatch(db, B.batchId, B.userId);

    expect(res.publicIds.some((id) => id.includes("generated"))).toBe(true);
  });

  it("leaves legacy rows behaving EXACTLY as before — a null intermediate is skipped", async () => {
    // Rows written before 0099 carry NULL here. They must sweep their two objects and
    // must not produce an empty-string id or a failed Cloudinary call.
    const rows = [{ ...row(), sourceImageUrl: null } as any];
    const { db } = fakeDb(rows, B);
    const res = await sweepAdCreativeBatch(db, B.batchId, B.userId);

    expect(res.publicIds).toHaveLength(2);
    expect(res.cloudinaryDeleted).toBe(2);
    expect(res.publicIds.every((id) => id.length > 0)).toBe(true);
  });

  it("still refuses on a protected service before touching Cloudinary, intermediate or not", async () => {
    const rows = [{ ...row({ serviceId: PROTECTED_SERVICE_IDS[0] }), sourceImageUrl: URL_SRC } as any];
    const { db } = fakeDb(rows, B);

    await expect(sweepAdCreativeBatch(db, B.batchId, B.userId)).rejects.toBeInstanceOf(ProtectedServiceError);
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("still deletes nothing on a userId mismatch, intermediate or not", async () => {
    const rows = [{ ...row(), sourceImageUrl: URL_SRC } as any];
    const { db, calls } = fakeDb(rows, B);
    const res = await sweepAdCreativeBatch(db, B.batchId, 999999);

    expect(res.rowsFound).toBe(0);
    expect(res.publicIds).toEqual([]);
    expect(calls.deleted).toBe(false);
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("de-duplicates across rows that share an intermediate", async () => {
    const rows = [
      { ...row({ id: 1 }), sourceImageUrl: URL_SRC } as any,
      { ...row({ id: 2 }), sourceImageUrl: URL_SRC } as any,
    ];
    const { db } = fakeDb(rows, B);
    const res = await sweepAdCreativeBatch(db, B.batchId, B.userId);

    // Two rows, identical urls on this fixture -> the id set must not double-count.
    expect(new Set(res.publicIds).size).toBe(res.publicIds.length);
  });
});
