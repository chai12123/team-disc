"use client";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AXES, AXIS_DEFINITIONS, type AxisKey } from "@/lib/model/axes";
import { SERIES_COLORS, SERIES_DASH, TARGET_COLOR } from "./chartTheme";

export interface RadarSeries {
  name: string;
  values: Record<AxisKey, number>;
  colorIndex?: number;
}

export interface TargetBand {
  min: Record<AxisKey, number>;
  max: Record<AxisKey, number>;
  label?: string;
}

interface Props {
  series: RadarSeries[];
  target?: TargetBand | null;
  height?: number;
  title?: string;
}

/**
 * Radar 8 แกน: โปรไฟล์เป้าหมาย (แถบสีเทา) ซ้อนกับผู้สมัคร (เส้น + ลวดลายต่างกัน)
 * ติดป้ายเสมอว่าสองชุดมาจากคนละแหล่ง; ตารางคะแนนอยู่คู่กันเสมอ (ดู ScoreTable)
 */
export function RadarChart({ series, target, height = 320, title }: Props) {
  const data = AXES.map((k) => {
    const row: Record<string, string | number> = { axis: k, label: `${k} ${AXIS_DEFINITIONS[k].nameTh}` };
    if (target) {
      row.targetMax = target.max[k];
      row.targetMin = target.min[k];
    }
    series.forEach((s, i) => {
      row[`s${i}`] = s.values[k];
    });
    return row;
  });
  const desc = `${title ?? "กราฟเรดาร์ 8 แกน"}: ${series.map((s) => `${s.name} = ${AXES.map((k) => `${k} ${s.values[k]}`).join(", ")}`).join("; ")}`;
  return (
    <figure aria-label={title ?? "กราฟเรดาร์ 8 แกน"} className="w-full">
      <div style={{ height }} role="img" aria-label={desc}>
        <ResponsiveContainer width="100%" height="100%">
          <RChart data={data} outerRadius="72%" margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
            {target && (
              <>
                <Radar name={target.label ?? "ช่วงเป้าหมายของบทบาท (สูงสุด)"} dataKey="targetMax" stroke={TARGET_COLOR} strokeWidth={1} strokeDasharray="3 3" fill={TARGET_COLOR} fillOpacity={0.18} isAnimationActive={false} />
                <Radar name="ช่วงเป้าหมายของบทบาท (ต่ำสุด)" dataKey="targetMin" stroke={TARGET_COLOR} strokeWidth={1} strokeDasharray="3 3" fill="var(--surface)" fillOpacity={1} isAnimationActive={false} />
              </>
            )}
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--foreground)", fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} />
            {series.map((s, i) => {
              const ci = s.colorIndex ?? i;
              return (
                <Radar
                  key={s.name}
                  name={s.name}
                  dataKey={`s${i}`}
                  stroke={SERIES_COLORS[ci % SERIES_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray={SERIES_DASH[ci % SERIES_DASH.length] || undefined}
                  fill={SERIES_COLORS[ci % SERIES_COLORS.length]}
                  fillOpacity={series.length > 1 ? 0.06 : 0.15}
                  dot={{ r: 3, strokeWidth: 1, fill: "var(--surface)" }}
                  isAnimationActive={false}
                />
              );
            })}
            <Tooltip
              formatter={(value, name) => [value as number, String(name)]}
              labelFormatter={(label) => {
                const k = label as AxisKey;
                return `${k} · ${AXIS_DEFINITIONS[k]?.nameTh ?? ""}`;
              }}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
            />
          </RChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted justify-center">
        {target && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-5 border border-dashed" style={{ borderColor: TARGET_COLOR, background: `${TARGET_COLOR}2e` }} />
            {target.label ?? "ช่วงเป้าหมายของบทบาท (องค์กรกำหนด)"}
          </span>
        )}
        {series.map((s, i) => {
          const ci = s.colorIndex ?? i;
          return (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <svg aria-hidden width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={SERIES_COLORS[ci % 4]} strokeWidth="2" strokeDasharray={SERIES_DASH[ci % 4] || undefined} /></svg>
              {s.name}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
