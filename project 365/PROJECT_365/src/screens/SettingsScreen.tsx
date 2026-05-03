// ============================================================
// PROJECT_365 — Settings Screen
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore, useThemeStore, useHabitsStore, useLogsStore } from '../store';
import { updateUserPreferences, updateUser } from '../services/firestore';
import { DARK_THEME, LIGHT_THEME, SPACING, FONT_SIZE, RADIUS } from '../theme';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';

export default function SettingsScreen() {
  const { user, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const { habits } = useHabitsStore();
  const { logsByMonth } = useLogsStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState(user?.preferences.notificationTime ?? '08:00');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          setUser(null);
        },
      },
    ]);
  };

  const handleSaveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    try {
      await updateUser(user.uid, { displayName: displayName.trim() });
      setUser({ ...user, displayName: displayName.trim() });
      Alert.alert('Saved', 'Display name updated.');
    } catch {
      Alert.alert('Error', 'Failed to update display name.');
    }
  };

  const handleNotificationToggle = async (val: boolean) => {
    setNotificationsEnabled(val);
    if (val) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Cannot enable notifications.');
        setNotificationsEnabled(false);
        return;
      }
      scheduleNotification(notifTime);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const scheduleNotification = async (time: string) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [hours, minutes] = time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📋 PROJECT_365',
        body: "Don't forget to log your habits today!",
        sound: true,
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      } as any,
    });
  };

  const handleExportCSV = () => {
    // Build CSV content
    const allLogs = Object.values(logsByMonth).flat();
    const rows = ['Date,Habit,Status'];
    for (const log of allLogs) {
      const habit = habits.find((h) => h.id === log.habitId);
      const statusLabel = log.status === 1 ? 'Complete' : log.status === 0.5 ? 'Partial' : 'Missed';
      rows.push(`${log.date},${habit?.name ?? log.habitId},${statusLabel}`);
    }
    const csv = rows.join('\n');
    Alert.alert('Export CSV', `${rows.length - 1} records ready.\n\n(In a production build, this would save/share the CSV file.)`);
  };

  const styles = makeStyles(T);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email}</Text>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.rowLabel}>Display Name</Text>
          <TextInput
            style={styles.inlineInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor={T.textMuted}
          />
        </View>
        <TouchableOpacity style={styles.smallBtn} onPress={handleSaveDisplayName}>
          <Text style={styles.smallBtnText}>Save Name</Text>
        </TouchableOpacity>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: T.border, true: T.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Daily Reminder</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: T.border, true: T.primary }}
            thumbColor="#fff"
          />
        </View>
        {notificationsEnabled && (
          <View style={styles.inputRow}>
            <Text style={styles.rowLabel}>Reminder Time</Text>
            <TextInput
              style={styles.inlineInput}
              value={notifTime}
              onChangeText={setNotifTime}
              placeholder="HH:MM"
              placeholderTextColor={T.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        )}
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <TouchableOpacity style={styles.actionRow} onPress={handleExportCSV}>
          <Text style={styles.actionRowText}>📤 Export CSV</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App</Text>
          <Text style={styles.rowValue}>PROJECT_365</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(T: typeof DARK_THEME) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    content: { padding: SPACING.lg, paddingBottom: 100 },
    title: { color: T.text, fontSize: FONT_SIZE.xl, fontWeight: '800', marginBottom: SPACING.lg },

    section: {
      backgroundColor: T.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: T.border,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    sectionTitle: {
      color: T.textMuted,
      fontSize: FONT_SIZE.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowLabel: { color: T.text, fontSize: FONT_SIZE.md, fontWeight: '500' },
    rowValue: { color: T.textSecondary, fontSize: FONT_SIZE.sm },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    inlineInput: {
      backgroundColor: T.surfaceElevated,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      color: T.text,
      fontSize: FONT_SIZE.sm,
      minWidth: 140,
      textAlign: 'right',
    },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    smallBtn: {
      backgroundColor: T.primary,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      alignSelf: 'flex-end',
    },
    smallBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.sm },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionRowText: { color: T.text, fontSize: FONT_SIZE.md, fontWeight: '500' },
    chevron: { color: T.textMuted, fontSize: 20 },
    signOutBtn: {
      backgroundColor: T.missed + '22',
      borderWidth: 1,
      borderColor: T.missed,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    signOutText: { color: T.missed, fontWeight: '700', fontSize: FONT_SIZE.md },
  });
}
