// ============================================================
// PROJECT_365 — Habit Manager Screen
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useAuthStore, useHabitsStore } from '../store';
import { useThemeStore } from '../store';
import { DARK_THEME, LIGHT_THEME, SPACING, FONT_SIZE, RADIUS, CATEGORY_COLORS } from '../theme';
import type { Habit, HabitCategory } from '../types';
import { v4 as uuidv4 } from 'uuid';

const CATEGORIES: HabitCategory[] = ['health', 'learning', 'mindset', 'work', 'routine', 'other'];

const PRESET_COLORS = [
  '#7C5CFC', '#22C55E', '#3B82F6', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#06B6D4', '#14B8A6', '#F97316',
];

export default function HabitManagerScreen() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const { habits, addHabit, editHabit, removeHabit, reorderHabits } = useHabitsStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Habit | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('health');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const activeHabits = habits.filter((h) => h.isActive);
  const archivedHabits = habits.filter((h) => !h.isActive);

  const openAdd = () => {
    setEditTarget(null);
    setName('');
    setCategory('health');
    setColor(PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const openEdit = (h: Habit) => {
    setEditTarget(h);
    setName(h.name);
    setCategory(h.category);
    setColor(h.color);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    if (editTarget) {
      await editHabit(user.uid, editTarget.id, { name: name.trim(), category, color });
    } else {
      const newHabit: Habit = {
        id: uuidv4(),
        name: name.trim(),
        category,
        order: habits.length,
        isActive: true,
        createdAt: new Date().toISOString(),
        color,
      };
      await addHabit(user.uid, newHabit);
    }
    setModalVisible(false);
  };

  const handleArchive = (h: Habit) => {
    if (!user) return;
    Alert.alert(
      'Archive Habit',
      `Archive "${h.name}"? History will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => removeHabit(user.uid, h.id),
        },
      ]
    );
  };

  const styles = makeStyles(T);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Habits</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Active habits */}
      <Text style={styles.sectionLabel}>Active ({activeHabits.length})</Text>
      {activeHabits.map((h) => (
        <HabitRow
          key={h.id}
          habit={h}
          theme={T}
          onEdit={() => openEdit(h)}
          onArchive={() => handleArchive(h)}
        />
      ))}

      {/* Archived habits */}
      {archivedHabits.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>
            Archived ({archivedHabits.length})
          </Text>
          {archivedHabits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              theme={T}
              archived
              onEdit={() => openEdit(h)}
              onArchive={() => {}}
            />
          ))}
        </>
      )}

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editTarget ? 'Edit Habit' : 'New Habit'}
            </Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Habit name"
              placeholderTextColor={T.textMuted}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor:
                        category === c
                          ? CATEGORY_COLORS[c] + '33'
                          : T.surfaceElevated,
                      borderColor:
                        category === c ? CATEGORY_COLORS[c] : T.border,
                    },
                  ]}
                  onPress={() => setCategory(c)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: category === c ? CATEGORY_COLORS[c] : T.textSecondary },
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    color === c && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: color }]}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>
                  {editTarget ? 'Save' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function HabitRow({
  habit,
  theme: T,
  onEdit,
  onArchive,
  archived = false,
}: {
  habit: Habit;
  theme: typeof DARK_THEME;
  onEdit: () => void;
  onArchive: () => void;
  archived?: boolean;
}) {
  const styles = makeStyles(T);
  return (
    <View style={[styles.row, archived && styles.rowArchived]}>
      <View style={[styles.rowDot, { backgroundColor: habit.color }]} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{habit.name}</Text>
        <Text style={[styles.rowCategory, { color: CATEGORY_COLORS[habit.category] }]}>
          {habit.category}
        </Text>
      </View>
      {!archived && (
        <View style={styles.rowActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
            <Text style={styles.actionBtnText}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.archiveBtn]} onPress={onArchive}>
            <Text style={styles.archiveBtnText}>⊖</Text>
          </TouchableOpacity>
        </View>
      )}
      {archived && (
        <Text style={styles.archivedBadge}>Archived</Text>
      )}
    </View>
  );
}

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
    title: { color: T.text, fontSize: FONT_SIZE.xl, fontWeight: '800' },
    addBtn: {
      backgroundColor: T.primary,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
    sectionLabel: {
      color: T.textMuted,
      fontSize: FONT_SIZE.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: SPACING.sm,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: T.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: T.border,
      gap: SPACING.sm,
    },
    rowArchived: { opacity: 0.5 },
    rowDot: { width: 12, height: 12, borderRadius: 6 },
    rowInfo: { flex: 1 },
    rowName: { color: T.text, fontSize: FONT_SIZE.md, fontWeight: '600' },
    rowCategory: { fontSize: FONT_SIZE.xs, fontWeight: '500', marginTop: 2, textTransform: 'capitalize' },
    rowActions: { flexDirection: 'row', gap: SPACING.sm },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: T.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnText: { color: T.text, fontSize: 16 },
    archiveBtn: { backgroundColor: T.missed + '22' },
    archiveBtnText: { color: T.missed, fontSize: 16 },
    archivedBadge: {
      color: T.textMuted,
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      borderWidth: 1,
      borderColor: T.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: T.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: 40,
      gap: SPACING.sm,
    },
    modalTitle: {
      color: T.text,
      fontSize: FONT_SIZE.xl,
      fontWeight: '800',
      marginBottom: SPACING.sm,
    },
    label: {
      color: T.textSecondary,
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      marginLeft: 4,
    },
    input: {
      backgroundColor: T.surfaceElevated,
      borderWidth: 1,
      borderColor: T.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: T.text,
      fontSize: FONT_SIZE.md,
    },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    categoryChip: {
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    categoryChipText: { fontSize: FONT_SIZE.xs, fontWeight: '600', textTransform: 'capitalize' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    colorSwatch: { width: 28, height: 28, borderRadius: 14 },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: '#fff',
      transform: [{ scale: 1.15 }],
    },
    modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
    cancelBtn: {
      flex: 1,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: T.surfaceElevated,
      alignItems: 'center',
    },
    cancelBtnText: { color: T.textSecondary, fontWeight: '600' },
    saveBtn: {
      flex: 1,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700' },
  });
}
