/**
 * Minimal parser for the exact ASCII DXF group-code subset `writeDxf`
 * emits, used only to round-trip test writer output against the source
 * IR — not a general DXF parser.
 */

export interface DxfEntity {
  readonly type: string;
  /** All group codes for this entity, in file order, including repeats (e.g. 10/20 per vertex). */
  readonly groups: readonly { code: number; value: string }[];
}

export interface DxfLwpolyline {
  readonly layer: string;
  readonly vertexCount: number;
  readonly closed: boolean;
  readonly points: readonly { x: number; y: number }[];
}

function parsePairs(dxf: string): { code: number; value: string }[] {
  const lines = dxf.split("\n");
  // A trailing "\n" from writeDxf leaves one empty line; drop it, then the
  // rest must come in (code, value) pairs.
  if (lines[lines.length - 1] === "") lines.pop();
  if (lines.length % 2 !== 0) throw new Error("malformed DXF: odd number of lines");

  const pairs: { code: number; value: string }[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    pairs.push({ code: Number(lines[i]), value: lines[i + 1]! });
  }
  return pairs;
}

/** Splits the ENTITIES section into individual entities (each starting at a `0` group). */
export function parseEntities(dxf: string): DxfEntity[] {
  const pairs = parsePairs(dxf);
  const entitiesStart = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
  if (entitiesStart === -1) throw new Error("no ENTITIES section found");

  const entities: DxfEntity[] = [];
  let current: { type: string; groups: { code: number; value: string }[] } | null = null;

  for (let i = entitiesStart + 1; i < pairs.length; i++) {
    const pair = pairs[i]!;
    if (pair.code === 0) {
      if (current) entities.push(current);
      if (pair.value === "ENDSEC") break;
      current = { type: pair.value, groups: [] };
    } else if (current) {
      current.groups.push(pair);
    }
  }

  return entities;
}

export function parseLwpolyline(entity: DxfEntity): DxfLwpolyline {
  if (entity.type !== "LWPOLYLINE") throw new Error(`expected LWPOLYLINE, got ${entity.type}`);

  const layer = entity.groups.find((g) => g.code === 8)!.value;
  const vertexCount = Number(entity.groups.find((g) => g.code === 90)!.value);
  const closed = Number(entity.groups.find((g) => g.code === 70)!.value) === 1;

  const points: { x: number; y: number }[] = [];
  const coordGroups = entity.groups.filter((g) => g.code === 10 || g.code === 20);
  for (let i = 0; i < coordGroups.length; i += 2) {
    points.push({ x: Number(coordGroups[i]!.value), y: Number(coordGroups[i + 1]!.value) });
  }

  return { layer, vertexCount, closed, points };
}
