// ============================================================
// PROJECT_365 — Dashboard Screen
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { VictoryBar, VictoryChart, VictoryAxis, VictoryTheme } from 'victory-native';
import { useAuthStore, useHabitsStore, useLogsStore, useAnalyticsStore } from '../store';
import { DARK_THEME, LIGHT_THEME, SPACING, FONT_SIZE, RADIUS, CELL_SIZE } from '../theme';
import { useThemeStore } from '../store';
import { formatPercent, toMonthString } from '../utils/calculations';
import type { MonthlySnapshot } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;

  const { habits, fetchHabits } = useHabitsStore();
  const { fetchLogsForMonth, logsByMonth } = useLogsStore();
  const { currentMonth, setCurrentMonth, fetchOrBuildSnapshot, snapshots } =
    useAnalyticsStore();

  const [snapshot, setSnapshot] = useState<MonthlySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await fetchHabits(user.uid);
      await fetchLogsForMonth(user.uid, currentMonth);
      const logs = logsByMonth[currentMonth] ?? [];
      const snap = await fetchOrBuildSnapshot(user.uid, currentMonth, habits, logs);
      setSnapshot(snap);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth]);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const navigateMonth = (direction: -1 | 1) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + direction);
    setCurrentMonth(toMonthString(d));
  };

  const weeklyData = snapshot
    ? [
        { x: 'W1', y: +(snapshot.weeklyAverages.week1 * 100).toFixed(1) },
        { x: 'W2', y: +(snapshot.weeklyAverages.week2 * 100).toFixed(1) },
        { x: 'W3', y: +(snapshot.weeklyAverages.week3 * 100).toFixed(1) },
        { x: 'W4', y: +(snapshot.weeklyAverages.week4 * 100).toFixed(1) },
      ]
    : [];

  const styles = makeStyles(T);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigateMonth(-1)}
          >
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {format(
              new Date(
                parseInt(currentMonth.split('-')[0]),
                parseInt(currentMonth.split('-')[1]) - 1
              ),
              'MMMM yyyy'
            )}
          </Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigateMonth(1)}
          >
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={T.primary} style={{ marginTop: 60 }} size="large" />
      ) : (
        <>
          {/* Circular Progress */}
          <View style={styles.progressCard}>
            <CircularProgress
              value={snapshot?.completionRate ?? 0}
              color={T.primary}
              theme={T}
            />
            <Text style={styles.progressLabel}>Monthly Completion</Text>
          </View>

          {/* Best / Worst */}
          <View style={styles.cardsRow}>
            {/* Best */}
            <View style={[styles.habitCard, { borderColor: T.complete }]}>
              <Text style={styles.cardIcon}>🏆</Text>
              <Text style={styles.cardTitle}>Best Habit</Text>
              <Text style={[styles.cardHabitName, { color: T.complete }]}>
                {snapshot?.bestHabit?.name ?? '—'}
              </Text>
              <Text style={styles.cardScore}>
                {snapshot?.bestHabit
                  ? formatPercent(snapshot.bestHabit.score)
                  : '—'}
              </Text>
            </View>

            {/* Worst */}
            <View style={[styles.habitCard, { borderColor: T.partial }]}>
              <Text style={styles.cardIcon}>⚠️</Text>
              <Text style={styles.cardTitle}>Needs Work</Text>
              <Text style={[styles.cardHabitName, { color: T.partial }]}>
                {snapshot?.worstHabit?.name ?? '—'}
              </Text>
              <Text style={styles.cardScore}>
                {snapshot?.worstHabit
                  ? formatPercent(snapshot.worstHabit.score)
                  : '—'}
              </Text>
            </View>
          </View>

          {/* Weekly bar chart */}
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Weekly Averages</Text>
            {weeklyData.length > 0 ? (
              <VictoryChart
                width={SCREEN_W - SPACING.lg * 2 - SPACING.md * 2}
                height={180}
                domainPadding={20}
                theme={VictoryTheme.material}
              >
                <VictoryAxis
                  style={{
                    tickLabels: { fill: T.textSecondary, fontSize: 12 },
                    axis: { stroke: T.border },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(t: number) => `${t}%`}
                  domain={[0, 100]}
                  style={{
                    tickLabels: { fill: T.textMuted, fontSize: 10 },
                    axis: { stroke: T.border },
                    grid: { stroke: T.border, strokeDasharray: '4,4' },
                  }}
                />
                <VictoryBar
                  data={weeklyData}
                  style={{
                    data: {
                      fill: T.primary,
                      opacity: 0.9,
                      borderRadius: 4,
                    },
                  }}
                  cornerRadius={{ top: 4 }}
                />
              </VictoryChart>
            ) : (
              <Text style={styles.emptyText}>No data for this month yet.</Text>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: T.complete }]}>
                {formatPercent(snapshot?.completionRate ?? 0)}
              </Text>
              <Text style={styles.statLabel}>Completion</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: T.missed }]}>
                {formatPercent(snapshot?.failureRate ?? 0)}
              </Text>
              <Text style={styles.statLabel}>Failure Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: T.primaryLight }]}>
                {habits.filter((h) => h.isActive).length}
              </Text>
              <Text style={styles.statLabel}>Active Habits</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── Circular Progress ─────────────────────────────────────────
function CircularProgress({
  value,
  color,
  theme: T,
}: {
  value: number;
  color: string;
  theme: typeof DARK_THEME;
}) {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: T.border,
        }}
      />
      {/* We approximate fill with an overlay view */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          opacity: 0.2 + value * 0.8,
        }}
      />
      <Text style={{ color: T.text, fontSize: FONT_SIZE.xxxl, fontWeight: '800' }}>
        {(value * 100).toFixed(1)}
      </Text>
      <Text style={{ color: T.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' }}>
        %
      </Text>
    </View>
  );
}

// ── Styles factory ─────────────────────────────────────────────
function makeStyles(T: typeof DARK_THEME) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    content: { padding: SPACING.lg, paddingBottom: 100 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.lg,
    },
    headerTitle: {
      color: T.text,
      fontSize: FONT_SIZE.xl,
      fontWeight: '800',
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: T.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnText: {
      color: T.text,
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 22,
    },
    monthLabel: {
      color: T.text,
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
    },
    progressCard: {
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: T.border,
    },
    progressLabel: {
      color: T.textSecondary,
      fontSize: FONT_SIZE.sm,
      marginTop: SPACING.sm,
      fontWeight: '600',
    },
    cardsRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    habitCard: {
      flex: 1,
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      alignItems: 'center',
    },
    cardIcon: { fontSize: 24, marginBottom: 4 },
    cardTitle: {
      color: T.textSecondary,
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardHabitName: {
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
      marginTop: 4,
      textAlign: 'center',
    },
    cardScore: {
      color: T.textMuted,
      fontSize: FONT_SIZE.sm,
      marginTop: 2,
    },
    chartCard: {
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: T.border,
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      color: T.text,
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
      marginBottom: SPACING.sm,
    },
    emptyText: {
      color: T.textMuted,
      textAlign: 'center',
      padding: SPACING.lg,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: T.border,
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
    statLabel: {
      color: T.textMuted,
      fontSize: FONT_SIZE.xs,
      marginTop: 2,
      fontWeight: '500',
    },
    statDivider: { width: 1, height: 40, backgroundColor: T.border },
  });
}
