import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  GRID_SIZE,
  MAX_RING,
  TOTAL_SQUARES,
  activeRegion,
  cellToIndex,
  indexToCell,
  milestoneForIndex,
  ringEnd,
  ringOfCell,
  ringOfIndex,
  ringSize,
  ringStart,
} from './geometry.ts'

test('rings tile the whole wall exactly', () => {
  let total = 0
  for (let r = 0; r <= MAX_RING; r++) {
    assert.equal(ringStart(r), total, `ring ${r} starts where the previous ended`)
    total += ringSize(r)
  }
  assert.equal(total, TOTAL_SQUARES)
  assert.equal(ringEnd(MAX_RING), TOTAL_SQUARES - 1)
})

test('ring 0 is the 2x2 center block', () => {
  assert.equal(ringSize(0), 4)
  const cells = [0, 1, 2, 3].map(indexToCell)
  const coords = cells.map((c) => `${c.x},${c.y}`).sort()
  assert.deepEqual(coords, ['499,499', '499,500', '500,499', '500,500'])
  for (const c of cells) assert.equal(c.ring, 0)
})

test('indexToCell and cellToIndex are inverses across every ring boundary', () => {
  const probes: number[] = []
  for (let r = 0; r <= MAX_RING; r++) {
    probes.push(ringStart(r), ringStart(r) + 1, ringEnd(r) - 1, ringEnd(r))
    probes.push(ringStart(r) + Math.floor(ringSize(r) / 3))
    probes.push(ringStart(r) + Math.floor(ringSize(r) / 2))
  }
  for (const i of probes) {
    if (i < 0 || i >= TOTAL_SQUARES) continue
    const cell = indexToCell(i)
    assert.equal(cellToIndex(cell.x, cell.y), i, `round trip failed at ${i}`)
    assert.equal(ringOfCell(cell.x, cell.y), cell.ring, `ring mismatch at ${i}`)
    assert.equal(ringOfIndex(i), cell.ring)
  }
})

test('the mapping is a bijection over an exhaustive sample of low rings', () => {
  // Rings 0..40 -> 6,724 cells. Exhaustive here, spot-checked above elsewhere.
  const end = ringEnd(40)
  const seen = new Set<string>()
  for (let i = 0; i <= end; i++) {
    const { x, y } = indexToCell(i)
    const key = `${x},${y}`
    assert.ok(!seen.has(key), `duplicate cell ${key} at index ${i}`)
    seen.add(key)
    assert.ok(x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE)
  }
  assert.equal(seen.size, end + 1)
})

test('every cell in the grid maps back to a unique index', () => {
  // Full 1,000,000-cell sweep: the addressing has to be exact, and this is the
  // only check that proves it end to end.
  const seen = new Uint8Array(TOTAL_SQUARES)
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = cellToIndex(x, y)
      assert.ok(i >= 0 && i < TOTAL_SQUARES, `index ${i} out of range for ${x},${y}`)
      assert.equal(seen[i], 0, `index ${i} claimed twice, at ${x},${y}`)
      seen[i] = 1
    }
  }
})

test('claimed area grows outward, never in a line', () => {
  // Each successive index is no further from the center than the next one.
  let prev = 0
  for (let i = 0; i < 20000; i++) {
    const r = indexToCell(i).ring
    assert.ok(r >= prev, `ring went backwards at index ${i}`)
    prev = r
  }
})

test('active region reports real remaining counts', () => {
  const fresh = activeRegion(0)
  assert.equal(fresh.ring, 0)
  assert.equal(fresh.remaining, 4)

  const midRing1 = activeRegion(ringStart(1) + 5)
  assert.equal(midRing1.ring, 1)
  assert.equal(midRing1.size, 12)
  assert.equal(midRing1.remaining, 12 - 5)

  // Exactly filling a ring rolls over to the next one.
  const rollover = activeRegion(ringEnd(1) + 1)
  assert.equal(rollover.ring, 2)
  assert.equal(rollover.remaining, ringSize(2))

  const soldOut = activeRegion(TOTAL_SQUARES)
  assert.equal(soldOut.remaining, 0)
})

test('milestones flag the documented ordinals only', () => {
  assert.equal(milestoneForIndex(0), 1)
  assert.equal(milestoneForIndex(999), 1000)
  assert.equal(milestoneForIndex(99_999), 100_000)
  assert.equal(milestoneForIndex(499_999), 500_000)
  assert.equal(milestoneForIndex(999_999), 1_000_000)
  assert.equal(milestoneForIndex(1), null)
  assert.equal(milestoneForIndex(1000), null)
})

test('out-of-range access is rejected rather than silently wrapping', () => {
  assert.throws(() => indexToCell(-1), RangeError)
  assert.throws(() => indexToCell(TOTAL_SQUARES), RangeError)
  assert.throws(() => cellToIndex(-1, 0), RangeError)
  assert.throws(() => cellToIndex(0, GRID_SIZE), RangeError)
})
