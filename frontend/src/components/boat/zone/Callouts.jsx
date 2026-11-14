import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LIGHT, ZONE_COLOURS } from "@/lib/zoneColours";

const ROW = 24;
const MAX_ROWS = 3;
export const ink = (c) => (LIGHT.has(c) ? "#0f172a" : "#fff");
const textW = (s) => (s.label || s.colour).length * 6.4 + 14;

// Zone names sit above or below the plan, never on it; overlapping names step out to a further row.
export const layoutLabels = (swatches, W) => {
  const out = {};
  ["top", "bottom"].forEach((band) => {
    const ends = [];
    swatches.map((s) => ({ s, w: textW(s), cx: (s.lx ?? s.x) * W })).filter(({ s }) => (s.band || (s.y < 0.5 ? "top" : "bottom")) === band)
      .sort((a, b) => a.cx - b.cx)
      .forEach(({ s, w, cx: want }) => {
        const fit = (c) => (w >= W ? W / 2 : Math.min(Math.max(c, w / 2), W - w / 2));
        let cx = fit(want);
        let row = ends.findIndex((e) => cx - w / 2 >= e + 4);
        if (row < 0 && ends.length < MAX_ROWS) row = ends.length;
        if (row < 0) { row = ends.indexOf(Math.min(...ends)); cx = fit(ends[row] + 4 + w / 2); }
        ends[row] = cx + w / 2;
        out[s.id] = { band, row, cx, w };
      });
  });
  return out;
};

const useSize = (ref) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const f = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
};

// A plan with a zone-coloured dot on each zone and a line out to its name.
export const CalloutPlan = ({ src, alt, imgClass, swatches, boxRef, selected, onDotDown, onLabelDown, onRemove, onClick, className = "", testId, planTestId }) => {
  const own = useRef(null);
  const box = boxRef || own;
  const { w: W, h: H } = useSize(box);
  const pos = layoutLabels(swatches, W);
  const rows = (band) => Math.max(0, ...Object.values(pos).filter((p) => p.band === band).map((p) => p.row + 1));
  const top = rows("top") * ROW + (rows("top") ? 6 : 0);
  const bottom = rows("bottom") * ROW + (rows("bottom") ? 6 : 0);
  const labelY = (p) => (p.band === "top" ? top - 6 - (p.row + 0.5) * ROW : top + H + 6 + (p.row + 0.5) * ROW);
  return (
    <div className={`relative mx-auto w-fit max-w-full ${className}`} style={{ paddingTop: top, paddingBottom: bottom }} onClick={onClick} data-testid={planTestId || testId}>
      <div ref={box} className="relative">
        <img src={src} alt={alt} className={imgClass} draggable={false} />
      </div>
      {W > 0 && (
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={W} height={top + H + bottom} aria-hidden="true">
          {swatches.map((s) => {
            const p = pos[s.id];
            const y2 = labelY(p) + (p.band === "top" ? ROW * 0.36 : -ROW * 0.36);
            const line = { x1: s.x * W, y1: top + s.y * H, x2: p.cx, y2 };
            return (
              <g key={s.id} data-testid={`${testId}-line-${s.id}`}>
                <line {...line} stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
                <line {...line} stroke={ZONE_COLOURS[s.colour]} strokeWidth="1.75" strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
      )}
      {W > 0 && swatches.map((s) => {
        const p = pos[s.id];
        const sel = selected === s.id;
        return (
          <span key={s.id} onClick={(e) => e.stopPropagation()}>
            <span className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center ${onDotDown ? "cursor-grab" : ""} ${sel ? "z-30" : "z-10"}`}
              style={{ left: s.x * W, top: top + s.y * H }} onPointerDown={onDotDown ? (e) => onDotDown(e, s) : undefined} data-testid={`${testId}-swatch-${s.id}`}>
              <span className={`block h-3.5 w-3.5 rounded-full shadow-md ring-2 ${sel ? "ring-[var(--navy)]" : "ring-white"}`} style={{ background: ZONE_COLOURS[s.colour] }} />
              {sel && onRemove && (
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => onRemove(e, s)} aria-label={`Remove ${s.label || s.colour}`} className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[var(--red)] shadow" data-testid={`${testId}-swatch-${s.id}-remove`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
            <span className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-extrabold shadow ${onLabelDown ? "cursor-grab" : ""}`}
              style={{ left: p.cx, top: labelY(p), background: ZONE_COLOURS[s.colour], color: ink(s.colour) }} onPointerDown={onLabelDown ? (e) => onLabelDown(e, s) : undefined} data-testid={`${testId}-label-${s.id}`}>
              {s.label || s.colour}
            </span>
          </span>
        );
      })}
    </div>
  );
};
