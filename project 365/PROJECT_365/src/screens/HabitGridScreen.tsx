// ============================================================
// PROJECT_365 — Habit Grid Screen
// ============================================================

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { format, parseISO } from 'date-fns';
import { useAuthStore, useHabitsStore, useLogsStore, useAnalyticsStore } from '../store';
import { useThemeStore } from '../store';
import { DARK_THEME, LIGHT_THEME, SPACING, FONT_SIZE, RADIUS, CELL_SIZE } from '../theme';
import {
  cycleStatus,
  formatPercent,
  getMonthDayGrid,
  habitCompletionRate,
  dailyScore,
} from '../utils/calculations';
import type { HabitStatus, HabitLog } from '../types';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_W } = Dimensions.get('window');
const LABEL_W = 110;

function statusIcon(status: HabitStatus | undefined): string {
  if (status === 1) return '✔';
  if (status === 0.5) return '⚠';
  if (status === 0) return '✗';
  return '–';
}

function statusColor(
  status: HabitStatus | undefined,
  T: typeof DARK_THEME
): string {
  if (status === 1) return T.complete;
  if (status === 0.5) return T.partial;
  if (status === 0) return T.missed;
  return T.noLog;
}

export default function HabitGridScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;

  const { habits, fetchHabits } = useHabitsStore();
  const { fetchLogsForMonth, logsByMonth, updateLog } = useLogsStore();
  const { currentMonth } = useAnalyticsStore();

  useEffect(() => {
    if (!user) return;
    fetchHabits(user.uid);
    fetchLogsForMonth(user.uid, currentMonth);
  }, [currentMonth, user]);

  const activeHabits = habits.filter((h) => h.isActive);
  const weekGroups = getMonthDayGrid(currentMonth);
  const monthLogs: HabitLog[] = logsByMonth[currentMonth] ?? [];

  const getLog = (habitId: string, date: string): HabitLog | undefined =>
    monthLogs.find((l) => l.habitId === habitId && l.date === date);

  const handleCellTap = useCallback(
    async (habitId: string, date: string) => {
      if (!user) return;
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const existing = getLog(habitId, date);
      const newStatus = cycleStatus(existing?.status);
      const log: HabitLog = {
        habitId,
        date,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      await updateLog(user.uid, log, true);
    },
    [user, monthLogs]
  );

  const styles = makeStyles(T);

  // ── Empty state ───────────────────────────────────────────
  if (activeHabits.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyIcon}>🗂</Text>
        <Text style={styles.emptyTitle}>No habits to track</Text>
        <Text style={styles.emptySubtitle}>
          Add your first habit to start filling in the grid.
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => navigation.navigate('Manager' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyBtnText}>+ Add your first habit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>Habit Grid</Text>
        <Text style={styles.monthLabel}>
          {format(
            new Date(
              parseInt(currentMonth.split('-')[0]),
              parseInt(currentMonth.split('-')[1]) - 1
            ),
            'MMMM yyyy'
          )}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Legend row */}
          <View style={styles.legendRow}>
            <View style={{ width: LABEL_W }} />
            {weekGroups.map((week, wi) => (
              <View key={wi} style={styles.weekGroup}>
                <Text style={styles.weekLabel}>Week {wi + 1}</Text>
                <View style={styles.weekDays}>
                  {week.map((day) => (
                    <View key={day.toISOString()} style={styles.dayHeader}>
                      <Text style={styles.dayNum}>{format(day, 'd')}</Text>
                      <Text style={styles.dayName}>{format(day, 'EEE').charAt(0)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <View style={styles.pctHeader}>
              <Text style={styles.pctLabel}>%</Text>
            </View>
          </View>

          {/* Habit rows */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {activeHabits.map((habit) => {
              const habitLogs = monthLogs.filter((l) => l.habitId === habit.id);
              const rate = habitCompletionRate(habitLogs);

              return (
                <View key={habit.id} style={styles.habitRow}>
                  {/* Sticky label */}
                  <TouchableOpacity
                    style={styles.habitLabel}
                    onPress={() =>
                      navigation.navigate('HabitDetail', { habitId: habit.id })
                    }
                  >
                    <View
                      style={[styles.habitDot, { backgroundColor: habit.color }]}
                    />
                    <Text style={styles.habitName} numberOfLines={1}>
                      {habit.name}
                    </Text>
                  </TouchableOpacity>

                  {/* Week cells */}
                  {weekGroups.map((week, wi) => (
                    <View key={wi} style={styles.weekGroup}>
                      <View style={styles.weekDays}>
                        {week.map((day) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const log = getLog(habit.id, dateStr);
                          return (
                            <TouchableOpacity
                              key={dateStr}
                              style={[
                                styles.cell,
                                {
                                  backgroundColor:
                                    log !== undefined
                                      ? `${statusColor(log.status, T)}22`
                                      : T.surface,
                                  borderColor:
                                    log !== undefined
                                      ? statusColor(log.status, T)
                                      : T.border,
                                },
                              ]}
                              onPress={() => handleCellTap(habit.id, dateStr)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.cellIcon,
                                  { color: statusColor(log?.status, T) },
                                ]}
                              >
                                {statusIcon(log?.status)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}

                  {/* % column */}
                  <View style={styles.pctCell}>
                    <Text
                      style={[
                        styles.pctValue,
                        {
                          color:
                            rate >= 0.7
                              ? T.complete
                              : rate >= 0.4
                              ? T.partial
                              : T.missed,
                        },
                      ]}
                    >
                      {(rate * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Daily score bottom row */}
          <View style={styles.habitRow}>
            <View style={styles.habitLabel}>
              <Text style={styles.scoreRowLabel}>Daily Score</Text>
            </View>
            {weekGroups.map((week, wi) => (
              <View key={wi} style={styles.weekGroup}>
                <View style={styles.weekDays}>
                  {week.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayLogs = monthLogs.filter((l) => l.date === dateStr);
                    const score = dayLogs.length > 0 ? dailyScore(dayLogs) : -1;
                    return (
                      <View key={dateStr} style={[styles.cell, styles.scoreCell]}>
                        <Text
                          style={[
                            styles.scoreCellText,
                            {
                              color:
                                score === -1
                                  ? T.textMuted
                                  : score >= 0.7
                                  ? T.complete
                                  : score >= 0.4
                                  ? T.partial
                                  : T.missed,
                            },
                          ]}
                        >
                          {score === -1 ? '–' : `${(score * 100).toFixed(0)}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={styles.pctCell} />
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {([
          { icon: '✔', label: 'Done', color: T.complete },
          { icon: '⚠', label: 'Partial', color: T.partial },
          { icon: '✗', label: 'Missed', color: T.missed },
          { icon: '–', label: 'No log', color: T.noLog },
        ] as const).map(({ icon, label, color }) => (
          <View key={label} style={styles.legendItem}>
            <Text style={[styles.legendIcon, { color }]}>{icon}</Text>
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(T: typeof DARK_THEME) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    headerTitle: { color: T.text, fontSize: FONT_SIZE.xl, fontWeight: '800' },
    monthLabel: { color: T.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },

    legendRow: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: SPACING.sm, paddingBottom: SPACING.xs },
    weekGroup: { flexDirection: 'column' },
    weekLabel: {
      color: T.textMuted,
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      textAlign: 'center',
      paddingBottom: 2,
      paddingHorizontal: SPACING.xs,
    },
    weekDays: { flexDirection: 'row' },
    dayHeader: {
      width: CELL_SIZE,
      alignItems: 'center',
      paddingVertical: 2,
    },
    dayNum: { color: T.textSecondary, fontSize: 11, fontWeight: '600' },
    dayName: { color: T.textMuted, fontSize: 10 },

    habitRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: SPACING.sm },
    habitLabel: {
      width: LABEL_W,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingRight: SPACING.sm,
    },
    habitDot: { width: 8, height: 8, borderRadius: 4 },
    habitName: { color: T.text, fontSize: FONT_SIZE.xs, fontWeight: '600', flex: 1 },

    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      margin: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellIcon: { fontSize: 14, fontWeight: '700' },

    pctHeader: { width: 48, alignItems: 'center' },
    pctLabel: { color: T.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '600' },
    pctCell: { width: 48, alignItems: 'center' },
    pctValue: { fontSize: FONT_SIZE.xs, fontWeight: '700' },

    scoreRowLabel: { color: T.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '600' },
    scoreCell: { backgroundColor: T.surfaceElevated, borderColor: T.border },
    scoreCellText: { fontSize: 10, fontWeight: '700' },

    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACING.lg,
      padding: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: T.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendIcon: { fontSize: 14, fontWeight: '700' },
    legendLabel: { color: T.textSecondary, fontSize: FONT_SIZE.xs },

    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
    emptyTitle: {
      color: T.text,
      fontSize: FONT_SIZE.xl,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    emptySubtitle: {
      color: T.textSecondary,
      fontSize: FONT_SIZE.md,
      textAlign: 'center',
      marginBottom: SPACING.xl,
      lineHeight: 22,
    },
    emptyBtn: {
      backgroundColor: T.primary,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      shadowColor: T.primary,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    emptyBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  });
}
