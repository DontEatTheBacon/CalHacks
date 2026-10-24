// Round-robin counselor choice (spec COUNSEL-002). The Convex mutation wraps this so the
// read-and-advance of the pointer is one transaction.
export interface CounselorSlot { id: string; rotationOrder: number; active: boolean }

export type Assignment =
  | { status: "assigned"; counselorId: string; newPointer: number; reused: boolean }
  | { status: "pending"; newPointer: number | null };

/** pointer = rotationOrder of the last counselor assigned (null before the first assignment). */
export function nextCounselor(counselors: CounselorSlot[], pointer: number | null, existingCounselorId: string | null = null): Assignment {
  const active = counselors.filter((c) => c.active).sort((a, b) => a.rotationOrder - b.rotationOrder);
  const existing = existingCounselorId ? active.find((c) => c.id === existingCounselorId) : undefined;
  if (existing) return { status: "assigned", counselorId: existing.id, newPointer: pointer ?? existing.rotationOrder, reused: true };
  if (active.length === 0) return { status: "pending", newPointer: pointer };
  const next = active.find((c) => pointer === null || c.rotationOrder > pointer) ?? active[0]!;
  return { status: "assigned", counselorId: next.id, newPointer: next.rotationOrder, reused: false };
}
