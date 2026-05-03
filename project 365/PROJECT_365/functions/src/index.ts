// ============================================================
// PROJECT_365 — Express REST API (Firebase Functions)
// ============================================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ── Auth Middleware ───────────────────────────────────────────

async function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── POST /api/auth/register ───────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { uid, displayName, email, timezone } = req.body;
  if (!uid || !email) {
    res.status(400).json({ error: 'uid and email required' });
    return;
  }
  await db.doc(`users/${uid}`).set({
    uid,
    displayName: displayName ?? 'User',
    email,
    timezone: timezone ?? 'UTC',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    preferences: { theme: 'dark', notificationTime: '08:00' },
  });
  res.json({ success: true });
});

// ── POST /api/auth/login ──────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  // Firebase handles auth client-side; this endpoint can return profile
  const { uid } = req.body;
  if (!uid) {
    res.status(400).json({ error: 'uid required' });
    return;
  }
  const doc = await db.doc(`users/${uid}`).get();
  if (!doc.exists) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(doc.data());
});

// ── GET /api/habits ───────────────────────────────────────────
app.get('/api/habits', authenticate, async (req: any, res) => {
  const snap = await db
    .collection(`users/${req.uid}/habits`)
    .orderBy('order')
    .get();
  res.json(snap.docs.map((d) => d.data()));
});

// ── POST /api/habits ──────────────────────────────────────────
app.post('/api/habits', authenticate, async (req: any, res) => {
  const habit = req.body;
  if (!habit.id || !habit.name) {
    res.status(400).json({ error: 'id and name required' });
    return;
  }
  await db.doc(`users/${req.uid}/habits/${habit.id}`).set(habit);
  res.json({ success: true, id: habit.id });
});

// ── PUT /api/habits/:id ───────────────────────────────────────
app.put('/api/habits/:id', authenticate, async (req: any, res) => {
  const { id } = req.params;
  await db.doc(`users/${req.uid}/habits/${id}`).update(req.body);
  res.json({ success: true });
});

// ── DELETE /api/habits/:id ────────────────────────────────────
app.delete('/api/habits/:id', authenticate, async (req: any, res) => {
  // Archive instead of delete
  await db
    .doc(`users/${req.uid}/habits/${req.params.id}`)
    .update({ isActive: false });
  res.json({ success: true });
});

// ── GET /api/logs?month=YYYY-MM ───────────────────────────────
app.get('/api/logs', authenticate, async (req: any, res) => {
  const { month } = req.query as { month?: string };
  let query = db.collection(`users/${req.uid}/habit_logs`);
  let q: FirebaseFirestore.Query = query;
  if (month) {
    q = q
      .where('date', '>=', `${month}-01`)
      .where('date', '<=', `${month}-31`);
  }
  const snap = await q.get();
  res.json(snap.docs.map((d) => d.data()));
});

// ── POST /api/logs ────────────────────────────────────────────
app.post('/api/logs', authenticate, async (req: any, res) => {
  const log = req.body;
  if (!log.habitId || !log.date || log.status === undefined) {
    res.status(400).json({ error: 'habitId, date, status required' });
    return;
  }
  const id = `${log.date}_${log.habitId}`;
  await db.doc(`users/${req.uid}/habit_logs/${id}`).set({
    ...log,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ success: true, id });
});

// ── POST /api/logs/bulk ───────────────────────────────────────
app.post('/api/logs/bulk', authenticate, async (req: any, res) => {
  const { logs } = req.body as { logs: any[] };
  if (!Array.isArray(logs) || !logs.length) {
    res.status(400).json({ error: 'logs array required' });
    return;
  }
  const batch = db.batch();
  for (const log of logs) {
    const id = `${log.date}_${log.habitId}`;
    batch.set(db.doc(`users/${req.uid}/habit_logs/${id}`), {
      ...log,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  res.json({ success: true, count: logs.length });
});

// ── GET /api/analytics/monthly?month=YYYY-MM ─────────────────
app.get('/api/analytics/monthly', authenticate, async (req: any, res) => {
  const { month } = req.query as { month?: string };
  if (!month) {
    res.status(400).json({ error: 'month param required (YYYY-MM)' });
    return;
  }

  // Check for cached snapshot
  const snapDoc = await db
    .doc(`users/${req.uid}/monthly_snapshots/${month}`)
    .get();
  if (snapDoc.exists) {
    res.json(snapDoc.data());
    return;
  }

  // Build snapshot on-demand
  const [habitsSnap, logsSnap] = await Promise.all([
    db.collection(`users/${req.uid}/habits`).orderBy('order').get(),
    db
      .collection(`users/${req.uid}/habit_logs`)
      .where('date', '>=', `${month}-01`)
      .where('date', '<=', `${month}-31`)
      .get(),
  ]);

  const habits = habitsSnap.docs.map((d) => d.data());
  const logs = logsSnap.docs.map((d) => d.data());

  // Compute scores
  const activeHabits = habits.filter((h: any) => h.isActive);
  const habitScores: Record<string, number> = {};
  for (const h of activeHabits) {
    const hLogs = logs.filter((l: any) => l.habitId === h.id);
    habitScores[h.id] =
      hLogs.length > 0
        ? hLogs.reduce((s: number, l: any) => s + l.status, 0) / hLogs.length
        : 0;
  }

  const rates = Object.values(habitScores) as number[];
  const completionRate =
    rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  let bestHabit = null;
  let worstHabit = null;
  if (activeHabits.length > 0) {
    let best = activeHabits[0] as any;
    let worst = activeHabits[0] as any;
    for (const h of activeHabits as any[]) {
      if ((habitScores[h.id] ?? 0) > (habitScores[best.id] ?? 0)) best = h;
      if ((habitScores[h.id] ?? 0) < (habitScores[worst.id] ?? 0)) worst = h;
    }
    bestHabit = { id: best.id, name: best.name, score: habitScores[best.id] };
    worstHabit = { id: worst.id, name: worst.name, score: habitScores[worst.id] };
  }

  const snapshot = {
    month,
    completionRate,
    failureRate: 1 - completionRate,
    bestHabit,
    worstHabit,
    habitScores,
    dailyScores: {},
    weeklyAverages: { week1: 0, week2: 0, week3: 0, week4: 0 },
    generatedAt: new Date().toISOString(),
  };

  await db
    .doc(`users/${req.uid}/monthly_snapshots/${month}`)
    .set(snapshot);

  res.json(snapshot);
});

// ── GET /api/analytics/streaks ────────────────────────────────
app.get('/api/analytics/streaks', authenticate, async (req: any, res) => {
  const habitsSnap = await db
    .collection(`users/${req.uid}/habits`)
    .where('isActive', '==', true)
    .get();
  const habits = habitsSnap.docs.map((d) => d.data());

  // Last 90 days
  const today = new Date().toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
    .toISOString()
    .split('T')[0];

  const logsSnap = await db
    .collection(`users/${req.uid}/habit_logs`)
    .where('date', '>=', ninetyDaysAgo)
    .where('date', '<=', today)
    .get();
  const logs = logsSnap.docs.map((d) => d.data()) as any[];

  const streaks = habits.map((h: any) => {
    const hLogs = logs.filter((l) => l.habitId === h.id);
    const logMap = new Map(hLogs.map((l) => [l.date, l.status]));

    let streak = 0;
    let cursor = new Date();
    while (true) {
      const key = cursor.toISOString().split('T')[0];
      if (logMap.get(key) === 1) {
        streak++;
        cursor = new Date(cursor.getTime() - 86400000);
      } else break;
    }
    return { habitId: h.id, name: h.name, currentStreak: streak };
  });

  res.json(streaks);
});

// ── Export as Firebase Function ───────────────────────────────
export const api = functions.https.onRequest(app);
