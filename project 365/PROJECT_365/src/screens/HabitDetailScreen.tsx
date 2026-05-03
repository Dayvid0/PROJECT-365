// ============================================================
// PROJECT_365 — Habit Detail Screen
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format, subMonths, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useAuthStore, useHabitsStore, useLogsStore } from '../store';
import { useThemeStore } from '../store';
import { DARK_THEME, LIGHT_THEME, SPACING, FONT_SIZE, RADIUS, CELL_SIZE, CATEGORY_COLORS } from '../theme';
import {
  habitCompletionRate,
  currentStreak,
  formatPercent,
} from '../utils/calculations';
import type { HabitLog, HabitStatus } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

function statusBg(status: HabitStatus | undefined, T: typeof DARK_THEME): string {
  if (status === 1) return T.complete;
  if (status === 0.5) return T.partial;
  if (status === 0) return T.missed;
  return T.border;
}

export default function HabitDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { habitId } = route.params;

  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const { habits } = useHabitsStore();
  const { logsByMonth, fetchLogsForMonth } = useLogsStore();

  const habit = habits.find((h) => h.id === habitId);

  // Load last 12 months of logs
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const now = new Date();

  useEffect(() => {
    if (!user || !habit) return;
    const promises = Array.from({ length: 12 }, (_, i) => {
      const month = format(subMonths(now, i), 'yyyy-MM');
      return fetchLogsForMonth(user.uid, month);
    });
    Promise.all(promises);
  }, [habit]);

  // Collect all logs for this habit
  useEffect(() => {
    const logs: HabitLog[] = [];
    Object.values(logsByMonth).forEach((monthLogs) => {
      monthLogs.forEach((l) => {
        if (l.habitId === habitId) logs.push(l);
      });
    });
    setAllLogs(logs);
  }, [logsByMonth, habitId]);

  if (!habit) {
    return (
      <View style={{ flex: 1, backgroundColor: T.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: T.text }}>Habit not found.</Text>
      </View>
    );
  }

  const currentMonth = format(now, 'yyyy-MM');
  const prevMonth = format(subMonths(now, 1), 'yyyy-MM');

  const currentMonthLogs = allLogs.filter((l) => l.date.startsWith(currentMonth));
  const prevMonthLogs = allLogs.filter((l) => l.date.startsWith(prevMonth));

  const currentRate = habitCompletionRate(currentMonthLogs);
  const prevRate = habitCompletionRate(prevMonthLogs);
  const trend = currentRate - prevRate;
  const streak = currentStreak(allLogs, now);

  const styles = makeStyles(T);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <View style={[styles.heroCard, { borderColor: habit.color }]}>
        <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[habit.category] + '33' }]}>
          <Text style={[styles.categoryText, { color: CATEGORY_COLORS[habit.category] }]}>
            {habit.category}
          </Text>
        </View>
        <Text style={styles.habitName}>{habit.name}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: T.primary }]}>
              {formatPercent(currentRate)}
            </Text>
            <Text style={styles.statLabel}>This month</Text>
          </View>
          <View style={styles.statBox}>
            <Text
              style={[
                styles.statValue,
                { color: trend >= 0 ? T.complete : T.missed },
              ]}
            >
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend * 100).toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>vs last month</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: T.partial }]}>
              🔥 {streak}
            </Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
        </View>
      </View>

      {/* Heatmap — last 12 months */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>12-Month Heatmap</Text>
        <HeatmapCalendar logs={allLogs} habitId={habitId} theme={T} />
      </View>

      {/* Monthly breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Breakdown (6 months)</Text>
        {Array.from({ length: 6 }, (_, i) => {
          const monthStr = format(subMonths(now, i), 'yyyy-MM');
          const mLogs = allLogs.filter((l) => l.date.startsWith(monthStr));
          const rate = habitCompletionRate(mLogs);
          return (
            <View key={monthStr} style={styles.monthRow}>
              <Text style={styles.monthLabel}>
                {format(subMonths(now, i), 'MMM yyyy')}
              </Text>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${rate * 100}%`,
                      backgroundColor:
                        rate >= 0.7 ? T.complete : rate >= 0.4 ? T.partial : T.missed,
                    },
                  ]}
                />
              </View>
              <Text style={styles.monthRate}>{formatPercent(rate)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Heatmap ───────────────────────────────────────────────────

function HeatmapCalendar({
  logs,
  habitId,
  theme: T,
}: {
  logs: HabitLog[];
  habitId: string;
  theme: typeof DARK_THEME;
}) {
  const now = new Date();
  const CELL = 12;
  const GAP = 2;
  const months = Array.from({ length: 12 }, (_, i) => subMonths(now, 11 - i));

  const logMap = new Map<string, HabitStatus>(
    logs.filter((l) => l.habitId === habitId).map((l) => [l.date, l.status])
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: GAP * 2 }}>
        {months.map((mDate) => {
          const month = format(mDate, 'yyyy-MM');
          const days = eachDayOfInterval({
            start: startOfMonth(mDate),
            end: endOfMonth(mDate),
          });
          return (
            <View key={month}>
              <Text
                style={{
                  color: T.textMuted,
                  fontSize: 9,
                  textAlign: 'center',
                  marginBottom: 2,
                }}
              >
                {format(mDate, 'MMM')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: (CELL + GAP) * 5 }}>
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const status = logMap.get(dateStr);
                  return (
                    <View
                      key={dateStr}
                      style={{
                        width: CELL,
                        height: CELL,
                        margin: GAP / 2,
                        borderRadius: 2,
                        backgroundColor:
                          status === 1
                            ? T.complete
                            : status === 0.5
                            ? T.partial
                            : status === 0
                            ? T.missed
                            : T.border,
                      }}
                    />
                  );
                })}
              </View>
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
    backBtn: { marginBottom: SPACING.md },
    backBtnText: { color: T.primary, fontSize: FONT_SIZE.md, fontWeight: '600' },

    heroCard: {
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      marginBottom: SPACING.lg,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      marginBottom: SPACING.sm,
    },
    categoryText: { fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase' },
    habitName: { color: T.text, fontSize: FONT_SIZE.xxl, fontWeight: '800', marginBottom: SPACING.md },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    statBox: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
    statLabel: { color: T.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },

    section: {
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: T.border,
      marginBottom: SPACING.md,
    },
    sectionTitle: { color: T.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.sm },

    monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    monthLabel: { color: T.textSecondary, fontSize: FONT_SIZE.xs, width: 72, fontWeight: '500' },
    barContainer: {
      flex: 1,
      height: 8,
      backgroundColor: T.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginHorizontal: SPACING.sm,
    },
    barFill: { height: '100%', borderRadius: 4 },
    monthRate: { color: T.text, fontSize: FONT_SIZE.xs, fontWeight: '700', width: 44, textAlign: 'right' },
  });
}
