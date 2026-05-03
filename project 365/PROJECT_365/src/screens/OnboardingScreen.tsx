// ============================================================
// PROJECT_365 — Onboarding Screen
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore, useHabitsStore } from '../store';
import { DARK_THEME, SPACING, FONT_SIZE, RADIUS } from '../theme';
import type { Habit, HabitCategory } from '../types';

const T = DARK_THEME;

type DefaultHabit = { name: string; category: HabitCategory; color: string };

const DEFAULT_HABITS: DefaultHabit[] = [
  { name: 'Wake up at 4:30',           category: 'routine',  color: '#F59E0B' },
  { name: 'Meditate',                   category: 'mindset',  color: '#8B5CF6' },
  { name: 'Pray and read Daily Text',   category: 'mindset',  color: '#8B5CF6' },
  { name: 'Push-ups',                   category: 'health',   color: '#22C55E' },
  { name: 'Read 30 minutes',            category: 'learning', color: '#3B82F6' },
  { name: 'Organised Environment',      category: 'routine',  color: '#EC4899' },
  { name: 'Journal',                    category: 'mindset',  color: '#8B5CF6' },
  { name: 'Code 30 minutes',            category: 'learning', color: '#3B82F6' },
  { name: 'Educational Podcasts',       category: 'learning', color: '#3B82F6' },
  { name: 'Arrive at work at 8am',      category: 'work',     color: '#F59E0B' },
  { name: 'Sober',                      category: 'health',   color: '#22C55E' },
  { name: 'Hydrate (full water bottle)',category: 'health',   color: '#22C55E' },
  { name: 'Positivity / Mindfulness',   category: 'mindset',  color: '#8B5CF6' },
  { name: 'Gratitude',                  category: 'mindset',  color: '#8B5CF6' },
  { name: 'Exercise',                   category: 'health',   color: '#22C55E' },
  { name: 'Eat Healthy',               category: 'health',   color: '#22C55E' },
  { name: 'Odoo Documentation',         category: 'work',     color: '#F59E0B' },
  { name: 'Chores',                     category: 'routine',  color: '#EC4899' },
  { name: 'Plan the next day',          category: 'routine',  color: '#EC4899' },
  { name: 'Work on Final Year Project', category: 'work',     color: '#F59E0B' },
  { name: 'Brush twice',               category: 'routine',  color: '#EC4899' },
  { name: 'Shower',                    category: 'routine',  color: '#EC4899' },
  { name: 'Less Social Media',         category: 'mindset',  color: '#8B5CF6' },
  { name: 'Daily check-in on sheet',   category: 'routine',  color: '#EC4899' },
  { name: 'Sleep at 11pm',             category: 'routine',  color: '#F59E0B' },
];

export default function OnboardingScreen() {
  const { user, completeOnboarding } = useAuthStore();
  const { bulkAddHabits, fetchHabits, habits } = useHabitsStore();
  const [loading, setLoading] = useState(false);

  // Returning user on a fresh install: if they already have habits, skip onboarding
  useEffect(() => {
    if (!user) return;
    fetchHabits(user.uid)
      .then(() => {
        const { habits: loaded } = useHabitsStore.getState();
        if (loaded.some((h) => h.isActive)) completeOnboarding();
      })
      .catch(() => {
        // Fetch failed — let user choose manually
      });
  }, [user]);

  const handleLoadDefaults = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const habits: Habit[] = DEFAULT_HABITS.map((h, i) => ({
        id: uuidv4(),
        name: h.name,
        category: h.category,
        color: h.color,
        order: i,
        isActive: true,
        createdAt: new Date().toISOString(),
      }));
      await bulkAddHabits(user.uid, habits);
    } finally {
      setLoading(false);
      completeOnboarding();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo */}
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>365</Text>
      </View>

      <Text style={styles.welcome}>
        Welcome{user?.displayName ? `, ${user.displayName}` : ''}!
      </Text>
      <Text style={styles.subtitle}>
        Let's set up your habits. You can add, edit, or remove them any time.
      </Text>

      {/* Default habits preview */}
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>25 habits ready to track</Text>
        {DEFAULT_HABITS.slice(0, 6).map((h, i) => (
          <View key={i} style={styles.previewRow}>
            <View style={[styles.dot, { backgroundColor: h.color }]} />
            <Text style={styles.previewName}>{h.name}</Text>
          </View>
        ))}
        <Text style={styles.previewMore}>+ {DEFAULT_HABITS.length - 6} more…</Text>
      </View>

      {/* Primary CTA */}
      <TouchableOpacity
        style={[styles.primaryBtn, loading && styles.btnDisabled]}
        onPress={handleLoadDefaults}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Load my default habits</Text>
        )}
      </TouchableOpacity>

      {/* Secondary CTA */}
      <TouchableOpacity
        style={[styles.secondaryBtn, loading && styles.btnDisabled]}
        onPress={completeOnboarding}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryBtnText}>Start from scratch</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    shadowColor: T.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  welcome: {
    color: T.text,
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: T.textSecondary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  previewCard: {
    width: '100%',
    backgroundColor: T.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  previewTitle: {
    color: T.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  previewName: { color: T.textSecondary, fontSize: FONT_SIZE.sm },
  previewMore: {
    color: T.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: T.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: T.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: { color: T.textSecondary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
