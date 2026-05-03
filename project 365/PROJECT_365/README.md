# PROJECT_365 — Habit Tracker App

## Setup

### 1. Firebase
Replace the placeholder values in `src/services/firebase.ts` with your own Firebase project config.

### 2. Install Dependencies
```bash
cd PROJECT_365
npm install
```

### 3. Run
```bash
npm start          # Expo dev server (scan QR with Expo Go)
npm run android    # Android emulator
npm run ios        # iOS simulator (macOS only)
npm run web        # Browser
```

---

## Project Structure
```
PROJECT_365/
├── App.tsx                       # Entry point, auth state listener
├── src/
│   ├── types/index.ts            # All TypeScript interfaces
│   ├── theme/index.ts            # Design tokens (dark/light)
│   ├── utils/
│   │   └── calculations.ts       # Pure score calculation functions
│   ├── services/
│   │   ├── firebase.ts           # Firebase app init (put your config here)
│   │   └── firestore.ts          # Firestore CRUD functions
│   ├── store/
│   │   └── index.ts              # Zustand stores (auth, theme, habits, logs, analytics)
│   ├── navigation/
│   │   └── AppNavigator.tsx      # React Navigation (bottom tabs + stack)
│   └── screens/
│       ├── AuthScreen.tsx        # Login / Register
│       ├── DashboardScreen.tsx   # Monthly overview, best/worst, weekly chart
│       ├── HabitGridScreen.tsx   # ✔⚠✗ tap-to-toggle grid
│       ├── HabitDetailScreen.tsx # Streak, heatmap, 6-month breakdown
│       ├── AnalyticsScreen.tsx   # Line/bar charts, weekly/monthly/yearly
│       ├── HabitManagerScreen.tsx # Add/edit/archive habits
│       └── SettingsScreen.tsx    # Notifications, theme, export, sign out
├── functions/
│   └── src/index.ts              # Express REST API (Firebase Functions)
└── babel.config.js
```

## Tech Stack
- **Frontend**: React Native + Expo (managed)
- **Backend**: Firebase Functions (Express)
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth
- **State**: Zustand (with persist for offline support)
- **Navigation**: React Navigation v7
- **Charts**: Victory Native
- **Date handling**: date-fns
- **Notifications**: Expo Notifications

## Status Values
| Symbol | Value | Meaning  |
|--------|-------|----------|
| ✔      | 1.0   | Complete |
| ⚠      | 0.5   | Partial  |
| ✗      | 0.0   | Missed   |
| –      | null  | No log   |

## Score Logic
- **Habit %** = sum(status) / tracked days
- **Daily score** = average of all active habits for that day
- **Weekly avg** = mean of daily scores in week 1-4 (dom buckets)
- **Monthly rate** = mean of all habit completion rates
- **Best/Worst** = habit with highest/lowest completion rate
- **Streak** = consecutive ✔ days going back from today
