'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PRICE_CHANNELS, type PriceHistoryRow } from '@/types/productDetail';

/**
 * 가격 추이 (계단형 선 그래프). 가격은 바뀌는 순간까지 그대로이므로 계단으로 그린다.
 * - 매장가/배달가 2개 시리즈: 범례 + 끝점 라벨, 색만으로 구분하지 않는다.
 * - 포인터/방향키로 변동 시점을 따라가는 세로선 + 툴팁 (두 시리즈 값을 함께 표시)
 * - 표로 보기: 툴팁 없이도 모든 값을 확인할 수 있다.
 */

// 너비는 실제 화면 폭을 재서 쓴다. (viewBox 로 늘리거나 줄이면 글자 크기가 함께 변한다)
const DEFAULT_W = 640;
const H = 240;
const M = { top: 18, right: 84, bottom: 30, left: 44 };
const PLOT_H = H - M.top - M.bottom;
const LABEL_MIN_GAP = 16;

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const shortDate = (time: number) =>
  new Date(time).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });

interface Series {
  key: (typeof PRICE_CHANNELS)[number]['key'];
  label: string;
  color: string;
  rows: { start: number; end: number | null; price: number }[];
}

function priceAt(series: Series, time: number): number | null {
  let value: number | null = null;
  for (const row of series.rows) {
    if (row.start <= time && (row.end === null || row.end > time)) value = row.price;
  }
  return value;
}

/** 500원 단위로 깔끔한 눈금 */
function niceTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1);
  const step = span > 4000 ? 2000 : span > 2000 ? 1000 : 500;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
  return ticks;
}

export default function PriceHistoryChart({
  rows,
  title,
}: {
  rows: PriceHistoryRow[];
  title: string;
}) {
  const now = useMemo(() => Date.now(), []);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DEFAULT_W);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const PLOT_W = W - M.left - M.right;

  const chart = useMemo(() => {
    const series: Series[] = PRICE_CHANNELS.map((channel) => ({
      ...channel,
      rows: rows
        .filter((row) => row.channel === channel.key)
        .map((row) => ({
          start: new Date(row.startedAt).getTime(),
          end: row.endedAt ? new Date(row.endedAt).getTime() : null,
          price: row.price,
        }))
        .sort((a, b) => a.start - b.start),
    })).filter((s) => s.rows.length > 0);

    const starts = series.flatMap((s) => s.rows.map((r) => r.start));
    const t0 = Math.min(...starts);
    const t1 = Math.max(now, t0 + 24 * 60 * 60 * 1000);
    const prices = series.flatMap((s) => s.rows.map((r) => r.price));
    const pad = Math.max(500, (Math.max(...prices) - Math.min(...prices)) * 0.2);
    const yMin = Math.max(0, Math.floor((Math.min(...prices) - pad) / 500) * 500);
    const yMax = Math.ceil((Math.max(...prices) + pad) / 500) * 500;

    const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * PLOT_W;
    const y = (p: number) => M.top + (1 - (p - yMin) / (yMax - yMin)) * PLOT_H;

    const paths = series.map((s) => {
      let d = `M ${x(s.rows[0].start)} ${y(s.rows[0].price)}`;
      for (const row of s.rows.slice(1)) d += ` H ${x(row.start)} V ${y(row.price)}`;
      const last = s.rows[s.rows.length - 1];
      const endTime = last.end ?? t1;
      d += ` H ${x(endTime)}`;
      return { ...s, d, endX: x(endTime), endY: y(last.price), endPrice: last.price };
    });

    // 끝점 라벨이 겹치면 붙이지 않고 범례·툴팁·표에 맡긴다.
    const ends = paths.map((p) => p.endY).sort((a, b) => a - b);
    const labelsFit = ends.every((v, i) => i === 0 || v - ends[i - 1] >= LABEL_MIN_GAP);

    // 툴팁이 멈추는 지점: 가격이 바뀐 시점들 + 오늘
    const stops = [...new Set([...starts, t1])].sort((a, b) => a - b);

    return { series, paths, x, y, yTicks: niceTicks(yMin, yMax), t0, t1, stops, labelsFit };
  }, [rows, now, W, PLOT_W]);

  const { paths, x, y, yTicks, t0, t1, stops, labelsFit } = chart;
  const activeTime = activeIndex === null ? null : stops[activeIndex];

  const nearestStop = (clientX: number, rect: DOMRect) => {
    const svgX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    stops.forEach((t, i) => {
      if (Math.abs(x(t) - svgX) < Math.abs(x(stops[best]) - svgX)) best = i;
    });
    return best;
  };

  const tooltipLeft = activeTime === null ? 0 : (x(activeTime) / W) * 100;

  return (
    <figure className="pd-chart">
      <figcaption className="pd-chart-head">
        <span>{title}</span>
        <ul className="pd-chart-legend" aria-label="범례">
          {paths.map((p) => (
            <li key={p.key}>
              <i style={{ background: p.color }} aria-hidden="true" />
              {p.label}
            </li>
          ))}
        </ul>
      </figcaption>

      <div className="pd-chart-frame" ref={frameRef}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}: ${paths
            .map((p) => `${p.label} ${won(p.rows[0].price)}에서 ${won(p.endPrice)}`)
            .join(', ')}. 방향키로 시점별 가격을 볼 수 있습니다.`}
          tabIndex={0}
          onPointerMove={(e) => setActiveIndex(nearestStop(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex((i) => i ?? stops.length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(0, (i ?? stops.length) - 1));
            if (e.key === 'ArrowRight') setActiveIndex((i) => Math.min(stops.length - 1, (i ?? -1) + 1));
          }}
        >
          {/* 눈금선 (가는 실선, 배경에서 한 단계 진한 회색) */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={M.left} x2={W - M.right} y1={y(tick)} y2={y(tick)} className="pd-chart-grid" />
              <text x={M.left - 8} y={y(tick)} className="pd-chart-tick" textAnchor="end" dominantBaseline="middle">
                {tick >= 1000 ? `${(tick / 1000).toLocaleString('ko-KR')}천` : tick}
              </text>
            </g>
          ))}
          <text x={M.left} y={H - 8} className="pd-chart-tick">{shortDate(t0)}</text>
          <text x={W - M.right} y={H - 8} className="pd-chart-tick" textAnchor="end">오늘</text>

          {paths.map((p) => (
            <g key={p.key}>
              <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={p.endX} cy={p.endY} r={4} fill={p.color} stroke="var(--paper)" strokeWidth={2} />
              {labelsFit && (
                <text x={p.endX + 10} y={p.endY} className="pd-chart-endlabel" dominantBaseline="middle">
                  {won(p.endPrice)}
                </text>
              )}
            </g>
          ))}

          {activeTime !== null && (
            <g aria-hidden="true">
              <line x1={x(activeTime)} x2={x(activeTime)} y1={M.top} y2={M.top + PLOT_H} className="pd-chart-crosshair" />
              {paths.map((p) => {
                const value = priceAt(p, Math.min(activeTime, t1 - 1));
                return value === null ? null : (
                  <circle key={p.key} cx={x(activeTime)} cy={y(value)} r={4} fill={p.color} stroke="var(--paper)" strokeWidth={2} />
                );
              })}
            </g>
          )}
        </svg>

        {activeTime !== null && (
          <div
            className={`pd-chart-tooltip ${tooltipLeft > 60 ? 'flip' : ''}`}
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <span className="pd-chart-tooltip-date">
              {activeTime >= t1 ? '오늘' : shortDate(activeTime)}
            </span>
            {paths.map((p) => {
              const value = priceAt(p, Math.min(activeTime, t1 - 1));
              return (
                <span key={p.key} className="pd-chart-tooltip-row">
                  <i style={{ background: p.color }} aria-hidden="true" />
                  <strong>{value === null ? '-' : won(value)}</strong>
                  <small>{p.label}</small>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <details className="pd-chart-table">
        <summary>가격 기록 표로 보기</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">구분</th>
              <th scope="col">가격</th>
              <th scope="col">적용 기간</th>
            </tr>
          </thead>
          <tbody>
            {paths.flatMap((p) =>
              p.rows.map((row) => (
                <tr key={`${p.key}-${row.start}`}>
                  <td>{p.label}</td>
                  <td>{won(row.price)}</td>
                  <td>
                    {shortDate(row.start)} ~ {row.end ? shortDate(row.end) : '현재'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
