// ============================================================
// PROJECT_365 — Firestore service layer
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Habit, HabitLog, MonthlySnapshot, User, HabitStatus } from '../types';

// ─── User ────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function createUser(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.uid), user);
}

export async function updateUserPreferences(
  uid: string,
  prefs: Partial<User['preferences']>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { preferences: prefs });
}

export async function updateUser(
  uid: string,
  updates: Partial<Omit<User, 'uid'>>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), updates as Record<string, unknown>);
}

// ─── Habits ──────────────────────────────────────────────────

export async function getHabits(uid: string): Promise<Habit[]> {
  const q = query(
    collection(db, 'users', uid, 'habits'),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Habit);
}

export async function createHabit(uid: string, habit: Habit): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'habits', habit.id), habit);
}

export async function updateHabit(
  uid: string,
  habitId: string,
  updates: Partial<Habit>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'habits', habitId), updates);
}

export async function deleteHabit(uid: string, habitId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'habits', habitId));
}

export async function bulkCreateHabits(uid: string, habits: Habit[]): Promise<void> {
  const batch = writeBatch(db);
  for (const habit of habits) {
    batch.set(doc(db, 'users', uid, 'habits', habit.id), habit);
  }
  await batch.commit();
}

// ─── Habit Logs ──────────────────────────────────────────────

export async function getLogsForMonth(
  uid: string,
  month: string // YYYY-MM
): Promise<HabitLog[]> {
  const q = query(
    collection(db, 'users', uid, 'habit_logs'),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as HabitLog);
}

export async function upsertLog(
  uid: string,
  log: HabitLog
): Promise<void> {
  const id = `${log.date}_${log.habitId}`;
  await setDoc(doc(db, 'users', uid, 'habit_logs', id), log);
}

export async function bulkUpsertLogs(
  uid: string,
  logs: HabitLog[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const log of logs) {
    const id = `${log.date}_${log.habitId}`;
    batch.set(doc(db, 'users', uid, 'habit_logs', id), log);
  }
  await batch.commit();
}

// ─── Monthly Snapshots ────────────────────────────────────────

export async function getMonthlySnapshot(
  uid: string,
  month: string
): Promise<MonthlySnapshot | null> {
  const snap = await getDoc(
    doc(db, 'users', uid, 'monthly_snapshots', month)
  );
  return snap.exists() ? (snap.data() as MonthlySnapshot) : null;
}

export async function saveMonthlySnapshot(
  uid: string,
  snapshot: MonthlySnapshot
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'monthly_snapshots', snapshot.month),
    snapshot
  );
}
