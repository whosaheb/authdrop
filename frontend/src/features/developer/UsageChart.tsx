import { useMemo, useState } from 'react';
import type { DailyMetric } from '../../api/types';
import { eventLabel } from '../../lib/format';

interface Props {
  daily: DailyMetric[];
  windowDays: number;
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };

function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Dependency-free SVG bar chart: one bar per day for the selected event (or all events). */
export function UsageChart({ daily, windowDays }: Props) {
  const events = useMemo(() => [...new Set(daily.map((d) => d.event))].sort(), [daily]);
  const [selected, setSelected] = useState<string>('all');
  const event = selected === 'all' || events.includes(selected) ? selected : 'all';

  const series = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const d of daily) if (event === 'all' || d.event === event) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.count);
    return lastDays(windowDays).map((day) => ({ day, count: byDay.get(day) ?? 0 }));
  }, [daily, windowDays, event]);

  const total = series.reduce((s, d) => s + d.count, 0);
  const max = niceMax(Math.max(0, ...series.map((d) => d.count)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / series.length;
  const barW = Math.max(2, slot * 0.68);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const label = event === 'all' ? 'all events' : eventLabel(event);

  return (
    <div className="chart">
      <div className="chart-head">
        <p className="chart-total">
          <strong>{total.toLocaleString()}</strong> <span className="muted">{label.toLowerCase()} in the last {windowDays} days</span>
        </p>
        <label className="chart-select">
          <span className="sr-only">Event to chart</span>
          <select className="input select input-sm" value={event} onChange={(e) => setSelected(e.target.value)}>
            <option value="all">All events</option>
            {events.map((e) => (
              <option key={e} value={e}>
                {eventLabel(e)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart of ${label} per day over the last ${windowDays} days. Total ${total}.`} className="chart-svg">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {series.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          return (
            <rect key={d.day} x={x} y={y(d.count)} width={barW} height={Math.max(h, d.count > 0 ? 1 : 0)} rx={2} className="chart-bar">
              <title>{`${d.day}: ${d.count}`}</title>
            </rect>
          );
        })}
        {series.map((d, i) =>
          i % Math.ceil(series.length / 6) === 0 ? (
            <text key={d.day} x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="chart-axis">
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
