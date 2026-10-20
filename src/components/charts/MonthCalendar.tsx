import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/common';
import { DAY_SHORT } from '@/domain/models/types';
import { localDate } from '@/domain/workout-engine';
import { useTheme } from '@/theme/ThemeProvider';

export interface MonthCalendarProps {
  year: number;
  month0: number;
  /** YYYY-MM-DD → count of sessions */
  marks: Map<string, number>;
  selected: string | null;
  onSelect: (date: string) => void;
  onChangeMonth: (year: number, month0: number) => void;
}

export function MonthCalendar({ year, month0, marks, selected, onSelect, onChangeMonth }: MonthCalendarProps) {
  const { colors, radius } = useTheme();
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const today = localDate(new Date());
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const prev = () => onChangeMonth(month0 === 0 ? year - 1 : year, month0 === 0 ? 11 : month0 - 1);
  const next = () => onChangeMonth(month0 === 11 ? year + 1 : year, month0 === 11 ? 0 : month0 + 1);
  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={prev} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month">
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="subheading">{title}</Text>
        <Pressable onPress={next} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next month">
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {DAY_SHORT.map((d) => (
          <Text key={d} variant="label" tone="muted" center style={styles.cell}>
            {d[0]}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.week}>
          {cells.slice(r * 7, r * 7 + 7).map((day, c) => {
            if (day === null) return <View key={c} style={styles.cell} />;
            const date = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const n = marks.get(date) ?? 0;
            const isSel = selected === date;
            return (
              <Pressable
                key={c}
                onPress={() => onSelect(date)}
                accessibilityRole="button"
                accessibilityLabel={`${date}${n ? `, ${n} workout${n > 1 ? 's' : ''}` : ''}`}
                style={[styles.cell, styles.day, { borderRadius: radius.md, backgroundColor: isSel ? colors.primary : n ? colors.successMuted : 'transparent', borderColor: date === today ? colors.primary : 'transparent' }]}
              >
                <Text weight={n ? 'semibold' : 'regular'} style={{ color: isSel ? colors.textOnPrimary : n ? colors.success : colors.text }}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40 },
  day: { margin: 2, borderWidth: 1.5 },
});
