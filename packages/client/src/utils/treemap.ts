import { DirectoryNode } from '@servercity/shared'

export interface TreemapRect {
  x: number   // center X
  z: number   // center Z
  w: number   // width along X
  d: number   // depth along Z
  node: DirectoryNode
}

interface Bounds {
  x: number   // left edge
  z: number   // front edge
  w: number   // total width
  d: number   // total depth
}

/** Squarified treemap — lays out nodes proportionally by sizeMb within bounds. */
export function squarify(nodes: DirectoryNode[], bounds: Bounds): TreemapRect[] {
  const nonEmpty = nodes.filter(n => n.sizeMb > 0)
  const zeroSize = nodes.filter(n => n.sizeMb <= 0)

  if (nonEmpty.length === 0 && zeroSize.length === 0) return []

  // Give zero-size items a minimum slice so they still appear
  const MIN_SIZE = 0.001
  const items = [
    ...nonEmpty,
    ...zeroSize.map(n => ({ ...n, sizeMb: MIN_SIZE })),
  ]

  const totalSize = items.reduce((s, n) => s + n.sizeMb, 0)
  const boundsArea = bounds.w * bounds.d
  const scaled = items.map(n => ({
    node: n,
    area: (n.sizeMb / totalSize) * boundsArea,
  }))

  return layoutRow(scaled, bounds, [])
}

function layoutRow(
  items: Array<{ node: DirectoryNode; area: number }>,
  bounds: Bounds,
  result: TreemapRect[],
): TreemapRect[] {
  if (items.length === 0) return result

  const { x, z, w, d } = bounds
  const isHorizontal = w >= d
  const length = isHorizontal ? w : d

  // Pick items for current row using squarified heuristic
  let rowItems = [items[0]]
  for (let i = 1; i < items.length; i++) {
    const candidate = [...rowItems, items[i]]
    if (worstRatio(rowItems, length) >= worstRatio(candidate, length)) {
      rowItems = candidate
    } else {
      break
    }
  }

  const rowArea = rowItems.reduce((s, it) => s + it.area, 0)
  const rowThickness = rowArea / length

  let offset = 0
  for (const item of rowItems) {
    const itemLength = item.area / rowThickness
    if (isHorizontal) {
      result.push({
        x: x + offset + itemLength / 2,
        z: z + rowThickness / 2,
        w: itemLength,
        d: rowThickness,
        node: item.node,
      })
    } else {
      result.push({
        x: x + rowThickness / 2,
        z: z + offset + itemLength / 2,
        w: rowThickness,
        d: itemLength,
        node: item.node,
      })
    }
    offset += itemLength
  }

  const remaining = items.slice(rowItems.length)
  if (remaining.length === 0) return result

  const newBounds: Bounds = isHorizontal
    ? { x, z: z + rowThickness, w, d: d - rowThickness }
    : { x: x + rowThickness, z, w: w - rowThickness, d }

  return layoutRow(remaining, newBounds, result)
}

function worstRatio(row: Array<{ area: number }>, length: number): number {
  if (row.length === 0) return Infinity
  const rowArea = row.reduce((s, it) => s + it.area, 0)
  const rowThickness = rowArea / length
  if (rowThickness <= 0) return Infinity
  let worst = 0
  for (const item of row) {
    const itemLength = item.area / rowThickness
    const ratio = Math.max(rowThickness / itemLength, itemLength / rowThickness)
    if (ratio > worst) worst = ratio
  }
  return worst
}

/** Color a directory node by last-modified time. */
export function nodeColor(lastModifiedDays: number): string {
  if (lastModifiedDays < 1) return '#f59e0b'    // amber  — today
  if (lastModifiedDays < 7) return '#3b82f6'    // blue   — this week
  if (lastModifiedDays < 30) return '#6b7280'   // gray   — this month
  return '#1f2937'                               // dark   — older
}

/** Emissive color for the same buckets. */
export function nodeEmissive(lastModifiedDays: number): string {
  if (lastModifiedDays < 1) return '#f59e0b'
  if (lastModifiedDays < 7) return '#2563eb'
  if (lastModifiedDays < 30) return '#4b5563'
  return '#111827'
}
