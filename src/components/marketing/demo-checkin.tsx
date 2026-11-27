"use client";

import { useState } from "react";
import {
  Check,
  Dumbbell,
  Heart,
  Leaf,
  Sparkles,
  Footprints,
  type LucideIcon,
} from "lucide-react";
import styles from "./landing.module.css";

const DEMO_HABITS: {
  id: string;
  title: string;
  detail: string;
  icon: LucideIcon;
}[] = [
  {
    id: "run",
    title: "Run or walk",
    detail: "20 min · your own pace",
    icon: Footprints,
  },
  {
    id: "strength",
    title: "Strength session",
    detail: "30 min · scheduled days",
    icon: Dumbbell,
  },
  {
    id: "nourish",
    title: "Build a balanced plate",
    detail: "Nourish to keep going",
    icon: Leaf,
  },
  {
    id: "reflect",
    title: "Read & reflect",
    detail: "10 min · evening",
    icon: Heart,
  },
];

export function DemoCheckin() {
  const [checked, setChecked] = useState<string[]>(["run", "nourish"]);
  const completed = checked.length;

  function toggleHabit(id: string) {
    setChecked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  return (
    <div className={styles.demoWindow}>
      <div className={styles.demoTop}>
        <span className={styles.windowDots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Daymark · daily view</span>
        <span>Today</span>
      </div>

      <div className={styles.demoBody}>
        <div className={styles.demoGreeting}>
          <div>
            <p className={styles.overline}>A good day to begin</p>
            <h3>Today</h3>
          </div>
          <span className={styles.demoCompletion}>
            {completed} of {DEMO_HABITS.length} done
          </span>
        </div>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Illustrative daily completion"
          aria-valuemin={0}
          aria-valuemax={DEMO_HABITS.length}
          aria-valuenow={completed}
        >
          <div
            className={styles.progressBar}
            style={{ width: `${(completed / DEMO_HABITS.length) * 100}%` }}
          />
        </div>

        <div className={styles.habitList}>
          {DEMO_HABITS.map((habit) => {
            const Icon = habit.icon;
            const isDone = checked.includes(habit.id);

            return (
              <button
                key={habit.id}
                type="button"
                className={styles.habitButton}
                aria-pressed={isDone}
                aria-label={`Mark ${habit.title} as ${
                  isDone ? "not done" : "done"
                }`}
                onClick={() => toggleHabit(habit.id)}
              >
                <span className={styles.habitIcon}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className={styles.habitCopy}>
                  <strong>{habit.title}</strong>
                  <small>{habit.detail}</small>
                </span>
                <span className={styles.demoCheck} aria-hidden="true">
                  {isDone ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <p className={styles.demoNote}>
          <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {completed === DEMO_HABITS.length
              ? "You kept the promises you chose for today."
              : "You do not need a perfect day. Choose your next step."}
          </span>
        </p>
      </div>

      <div className={styles.demoDisclaimer}>
        Illustrative preview · Demo state stays in this page only
      </div>
    </div>
  );
}
