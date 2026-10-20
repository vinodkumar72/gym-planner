import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/common';

export interface LinePoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  points: LinePoint[];
  height?: number;
  width?: number;
  unit?: string;
  accessibilityLabel?: string;
}

/** Minimal, dependency-light line chart. Shows the last ~20 points with min/max guides. */
export function LineChart({ points, height = 180, width = 320, unit = '', accessibilityLabel }: LineChartProps) {
  const { colors } = useTheme();
  const data = points.slice(-20);
  if (data.length === 0) {
    return <Text tone="muted">No data yet.</Text>;
  }
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const values = data.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => padL + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => padT + h - ((v - min) / span) * h;
  const d = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const first = data[0];
  const last = data[data.length - 1];
  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? `Line chart from ${first?.label} to ${last?.label}, latest ${last?.value}${unit}`}>
      <Svg width={width} height={height}>
        <Line x1={padL} x2={width - padR} y1={y(max)} y2={y(max)} stroke={colors.border} strokeDasharray="4 4" />
        <Line x1={padL} x2={width - padR} y1={y(min)} y2={y(min)} stroke={colors.border} strokeDasharray="4 4" />
        <SvgText x={padL - 6} y={y(max) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
          {`${max}${unit}`}
        </SvgText>
        {max !== min ? (
          <SvgText x={padL - 6} y={y(min) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
            {`${min}${unit}`}
          </SvgText>
        ) : null}
        <Path d={d} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((p, i) => (
          <Circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={colors.primary} />
        ))}
        {first ? (
          <SvgText x={x(0)} y={height - 8} fontSize={11} fill={colors.textMuted} textAnchor="start">
            {first.label}
          </SvgText>
        ) : null}
        {last && data.length > 1 ? (
          <SvgText x={x(data.length - 1)} y={height - 8} fontSize={11} fill={colors.textMuted} textAnchor="end">
            {last.label}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
