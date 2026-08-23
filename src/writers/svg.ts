/**
 * SVG output writer (PLAN.md Stage 3): a pure `VectorDocument -> string`
 * function, tested only against hand-built IR fixtures — it has no
 * dependency on the vision pipeline that produces real documents.
 *
 * Each `VectorShape` becomes one `<path>` combining its outer contour and
 * every hole as separate subpaths (`M...Z M...Z ...`) under a single
 * `fill-rule="evenodd"`. Evenodd renders holes correctly from subpath
 * nesting alone, regardless of each contour's actual winding direction —
 * so, unlike a `fill-rule="nonzero"` approach, this writer never needs to
 * inspect or normalize `Contour.winding`.
 */

import type { PathSegment, Unit, VectorDocument, VectorPath } from "../ir/types.js";

export interface SvgWriteOptions {
  /** Decimal places for coordinates. Default 2. */
  readonly precision?: number;
  /** CSS stroke color. Default `"#000"`. */
  readonly stroke?: string;
  /** CSS stroke width, in the document's unit. Default 1. */
  readonly strokeWidth?: number;
  /** CSS fill. Default `"none"` — most maker-tool consumers want outlines, not filled shapes. */
  readonly fill?: string;
}

const SVG_UNIT_SUFFIX: Record<Unit, string> = {
  px: "",
  mm: "mm",
  in: "in",
};

function formatNumber(value: number, precision: number): string {
  return Number(value.toFixed(precision)).toString();
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function segmentToD(segment: PathSegment, fmt: (n: number) => string): string {
  if (segment.type === "line") {
    return `L ${fmt(segment.to.x)},${fmt(segment.to.y)}`;
  }
  return (
    `C ${fmt(segment.control1.x)},${fmt(segment.control1.y)} ` +
    `${fmt(segment.control2.x)},${fmt(segment.control2.y)} ` +
    `${fmt(segment.to.x)},${fmt(segment.to.y)}`
  );
}

function pathToD(path: VectorPath, fmt: (n: number) => string): string {
  const commands = [`M ${fmt(path.start.x)},${fmt(path.start.y)}`];
  for (const segment of path.segments) commands.push(segmentToD(segment, fmt));
  if (path.closed) commands.push("Z");
  return commands.join(" ");
}

/** Renders `doc` as a complete, self-contained SVG document string. */
export function writeSvg(doc: VectorDocument, options: SvgWriteOptions = {}): string {
  const { precision = 2, stroke = "#000", strokeWidth = 1, fill = "none" } = options;
  const fmt = (n: number): string => formatNumber(n, precision);
  const unitSuffix = SVG_UNIT_SUFFIX[doc.unit];

  const paths = doc.shapes.map((shape) => {
    const d = [shape.outer, ...shape.holes].map((contour) => pathToD(contour.path, fmt)).join(" ");
    return (
      `  <path id="${escapeAttr(shape.id)}" d="${d}" fill="${escapeAttr(fill)}" ` +
      `fill-rule="evenodd" stroke="${escapeAttr(stroke)}" stroke-width="${strokeWidth}"/>`
    );
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(doc.width)}${unitSuffix}" ` +
      `height="${fmt(doc.height)}${unitSuffix}" viewBox="0 0 ${fmt(doc.width)} ${fmt(doc.height)}">`,
    ...paths,
    `</svg>`,
  ].join("\n");
}
