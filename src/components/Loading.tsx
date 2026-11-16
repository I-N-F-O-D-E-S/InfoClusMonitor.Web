import type { CSSProperties } from "react";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

/**
 * Esqueleto de tabla (patrón de consola cloud):
 * bloques neutros con pulso suave, sin gradientes ni spinners de colores.
 */
export const TableSkeleton = ({ rows = 6, cols = 5 }: TableSkeletonProps) => {
  const gridStyle = (count: number): CSSProperties => ({
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
  });

  return (
    <div className="skeleton-table" role="status" aria-busy="true" aria-label="Cargando contenido">
      <span className="sr-only">Cargando…</span>

      <div className="skeleton-row skeleton-row--head" style={gridStyle(cols)}>
        {Array.from({ length: cols }).map((_, i) => (
          <span className="skeleton-cell skeleton-cell--head" key={`h-${i}`} />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-row" key={`r-${r}`} style={gridStyle(cols)}>
          {Array.from({ length: cols }).map((_, c) => (
            <span
              className="skeleton-cell"
              key={`c-${r}-${c}`}
              style={{ width: `${55 + ((r + c) % 4) * 12}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
