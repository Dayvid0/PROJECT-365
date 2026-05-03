// ============================================================
// PROJECT_365 — Analytics Screen
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  VictoryLine,
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryTheme,
  VictoryLegend,
} from 'victory-native';
import { format, subDays, subMonths, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useAuthStore, useHabitsStore, useLogsStore, useAnalyticsStore } from '../store';
import { useThemeStore } from '../store';
import { DARK_THEME, LIGHT_THEME, SPACING, FONT_SIZE, RADIUS, CATEGORY_COLORS } from '../theme';
import { dailyScore, habitCompletionRate, formatPercent } from '../utils/calculations';
import type { HabitLog } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - SPACING.lg * 2 - SPACING.md * 2;

type ViewMode = 'weekly' | 'monthly' | 'yearly';

export default function AnalyticsScreen() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const { habits } = useHabitsStore();
  const { logsByMonth, fetchLogsForMonth } = useLogsStore();

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const now = new Date();

  useEffect(() => {
    if (!user) return;
    for (let i = 0; i < 12; i++) {
      const month = format(subMonths(now, i), 'yyyy-MM');
      fetchLogsForMonth(user.uid, month);
    }
  }, [user]);

  const allLogs: HabitLog[] = Object.values(logsByMonth).flat();
  const activeHabits = habits.filter((h) => h.isActive);

  // ── Daily scores line chart data ─────────────────────────────
  const getDaysRange = (): Date[] => {
    if (viewMode === 'weekly') return eachDayOfInterval({ start: subDays(now, 6), end: now });
    if (viewMode === 'monthly') {
      return eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
    }
    // yearly — show monthly averages
    return Array.from({ length: 12 }, (_, i) => subMonths(now, 11 - i));
  };

  const lineData = getDaysRange().map((d, i) => {
    if (viewMode === 'yearly') {
      // Monthly average
      const monthStr = format(d, 'yyyy-MM');
      const mLogs = allLogs.filter((l) => l.date.startsWith(monthStr));
      const days = eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) });
      const scores = days
        .map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayLogs = mLogs.filter((l) => l.date === dayStr);
          return dayLogs.length > 0 ? dailyScore(dayLogs) : null;
        })
        .filter((s) => s !== null) as number[];
      const avg = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      return { x: i + 1, y: +(avg * 100).toFixed(1), label: format(d, 'MMM') };
    } else {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = allLogs.filter((l) => l.date === dateStr);
      const score = dayLogs.length > 0 ? dailyScore(dayLogs) : 0;
      return {
        x: i + 1,
        y: +(score * 100).toFixed(1),
        label: format(d, viewMode === 'weekly' ? 'EEE' : 'd'),
      };
    }
  });

  // ── Habit comparison bar chart ────────────────────────────────
  const habitBarData = activeHabits.slice(0, 8).map((h, i) => {
    const hLogs = allLogs.filter((l) => l.habitId === h.id);
    const rate = habitCompletionRate(hLogs);
    return { x: i + 1, y: +(rate * 100).toFixed(1), label: h.name.slice(0, 8) };
  });

  const styles = makeStyles(T);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Analytics</Text>

      {/* Mode tabs */}
      <View style={styles.tabs}>
        {(['weekly', 'monthly', 'yearly'] as ViewMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.tab, viewMode === m && styles.tabActive]}
            onPress={() => setViewMode(m)}
          >
            <Text style={[styles.tabText, viewMode === m && styles.tabTextActive]}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Line chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Scores</Text>
        <VictoryChart width={CHART_W} height={200} theme={VictoryTheme.material}>
          <VictoryAxis
            tickCount={viewMode === 'monthly' ? 6 : undefined}
            tickFormat={(t: number) => lineData[t - 1]?.label ?? ''}
            style={{
              tickLabels: { fill: T.textMuted, fontSize: 9 },
              axis: { stroke: T.border },
              grid: { stroke: 'transparent' },
            }}
          />
          <VictoryAxis
            dependentAxis
            tickFormat={(t: number) => `${t}%`}
            domain={[0, 100]}
            style={{
              tickLabels: { fill: T.textMuted, fontSize: 9 },
              axis: { stroke: T.border },
              grid: { stroke: T.border, strokeDasharray: '4,4' },
            }}
          />
          <VictoryLine
            data={lineData}
            style={{
              data: { stroke: T.primary, strokeWidth: 2 },
            }}
            animate={{ duration: 400 }}
          />
        </VictoryChart>
      </View>

      {/* Habit comparison */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Habit Performance</Text>
        <VictoryChart width={CHART_W} height={220} domainPadding={12} theme={VictoryTheme.material}>
          <VictoryAxis
            tickFormat={(t: number) => habitBarData[t - 1]?.label ?? ''}
            style={{
              tickLabels: { fill: T.textMuted, fontSize: 8, angle: -20 },
              axis: { stroke: T.border },
              grid: { stroke: 'transparent' },
            }}
          />
          <VictoryAxis
            dependentAxis
            tickFormat={(t: number) => `${t}%`}
            domain={[0, 100]}
            style={{
              tickLabels: { fill: T.textMuted, fontSize: 9 },
              axis: { stroke: T.border },
              grid: { stroke: T.border, strokeDasharray: '4,4' },
            }}
          />
          <VictoryBar
            data={habitBarData}
            style={{
              data: {
                fill: ({ datum }: any) =>
                  datum.y >= 70
                    ? T.complete
                    : datum.y >= 40
                    ? T.partial
                    : T.missed,
              },
            }}
            cornerRadius={{ top: 4 }}
          />
        </VictoryChart>

        {/* Legend */}
        <View style={styles.habitLegend}>
          {activeHabits.slice(0, 8).map((h, i) => (
            <View key={h.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: h.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {i + 1}. {h.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Summary stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overall Stats</Text>
        {activeHabits.map((h) => {
          const hLogs = allLogs.filter((l) => l.habitId === h.id);
          const rate = habitCompletionRate(hLogs);
          return (
            <View key={h.id} style={styles.statRow}>
              <View style={[styles.statDot, { backgroundColor: h.color }]} />
              <Text style={styles.statName}>{h.name}</Text>
              <View style={styles.statBarWrap}>
                <View
                  style={[
                    styles.statBar,
                    {
                      width: `${rate * 100}%`,
                      backgroundColor:
                        rate >= 0.7 ? T.complete : rate >= 0.4 ? T.partial : T.missed,
                    },
                  ]}
                />
              </View>
              <Text style={styles.statPct}>{formatPercent(rate)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function makeStyles(T: typeof DARK_THEME) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    content: { padding: SPACING.lg, paddingBottom: 100 },
    title: { color: T.text, fontSize: FONT_SIZE.xl, fontWeight: '800', marginBottom: SPACING.lg },

    tabs: {
      flexDirection: 'row',
      backgroundColor: T.surface,
      borderRadius: RADIUS.md,
      padding: 4,
      marginBottom: SPACING.md,
      gap: 4,
    },
    tab: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, alignItems: 'center' },
    tabActive: { backgroundColor: T.primary },
    tabText: { color: T.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.sm },
    tabTextActive: { color: '#fff' },

    card: {
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: T.border,
      marginBottom: SPACING.md,
    },
    cardTitle: { color: T.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.sm },

    habitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: '45%' },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: T.textSecondary, fontSize: FONT_SIZE.xs, flex: 1 },

    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    statDot: { width: 8, height: 8, borderRadius: 4 },
    statName: { color: T.text, fontSize: FONT_SIZE.xs, width: 90, fontWeight: '500' },
    statBarWrap: {
      flex: 1,
      height: 8,
      backgroundColor: T.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    statBar: { height: '100%', borderRadius: 4 },
    statPct: { color: T.textSecondary, fontSize: FONT_SIZE.xs, width: 44, textAlign: 'right', fontWeight: '600' },
  });
}
