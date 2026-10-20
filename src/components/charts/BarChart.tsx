import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/common';

export interface BarPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface BarChartProps {
  points: BarPoint[];
  height?: number;
  width?: number;
  target?: number;
  accessibilityLabel?: string;
}

export function BarChart({ points, height = 160, width = 320, target, accessibilityLabel }: BarChartProps) {
  const { colors } = useTheme();
  if (points.length === 0) return <Text tone="muted">No data yet.</Text>;
  const padT = 16;
  const padB = 24;
  const h = height - padT - padB;
  const max = Math.max(target ?? 0, ...points.map((p) => p.value), 1);
  const slot = width / points.length;
  const barW = Math.max(6, Math.min(28, slot * 0.6));
  const y = (v: number) => padT + h - (v / max) * h;
  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? points.map((p) => `${p.label}: ${p.value}`).join(', ')}>
      <Svg width={width} height={height}>
        {target ? <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={colors.success} strokeDasharray="4 4" /> : null}
        {points.map((p, i) => {
          const cx = slot * i + slot / 2;
          return (
            <React.Fragment key={i}>
              <Rect x={cx - barW / 2} y={y(p.value)} width={barW} height={Math.max(0, padT + h - y(p.value))} rx={4} fill={p.highlight ? colors.primary : colors.primaryMuted} />
              {p.value > 0 ? (
                <SvgText x={cx} y={y(p.value) - 4} fontSize={11} fill={colors.text} textAnchor="middle">
                  {String(p.value)}
                </SvgText>
              ) : null}
              <SvgText x={cx} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                {p.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
