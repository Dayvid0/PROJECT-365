import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import styles from "./auth-shell.module.css";

export type AuthMode = "signin" | "create";

const COPY: Record<
  AuthMode,
  {
    eyebrow: string;
    title: string;
    intro: string;
    switchLabel: string;
    privacy: string;
  }
> = {
  signin: {
    eyebrow: "YOUR PRACTICE, YOUR PACE",
    title: "Welcome back.",
    intro: "Sign in to return to your practice.",
    switchLabel: "New to Daymark?",
    privacy: "Private by default. Your habits stay yours.",
  },
  create: {
    eyebrow: "A FRESH START",
    title: "Begin with intention.",
    intro: "Create a space for the habits that matter to you.",
    switchLabel: "Already have a practice?",
    privacy: "No email verification needed. Your habits stay yours.",
  },
};

export function AuthShell({
  mode,
  children,
}: {
  mode: AuthMode;
  children: ReactNode;
}) {
  const copy = COPY[mode];

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-labelledby="auth-story-title">
        <div className={`${styles.orbit} ${styles.orbitOne}`} aria-hidden="true" />
        <div className={`${styles.orbit} ${styles.orbitTwo}`} aria-hidden="true" />
        <div className={styles.orbitCore} aria-hidden="true">
          <span />
        </div>

        <Link className={styles.brand} href="/" aria-label="Daymark home">
          <Image className={styles.brandImage} src="/icon.svg" alt="" width={35} height={35} priority />
          <span>daymark</span>
        </Link>

        <div className={styles.storyCopy}>
          <span className={styles.eyebrow}>
            <i /> DISCIPLINE FOR THE LIFE YOU WANT
          </span>
          <h1 id="auth-story-title" className={styles.storyTitle}>
            Show up.
            <br />
            <em>Again.</em>
          </h1>
          <p>
            Build a rhythm that fits your life. One small promise, kept at your
            own pace.
          </p>
          <div className={styles.promise}>
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Consistency over perfection.</span>
          </div>
        </div>

        <div className={styles.storyBottom}>
          <span>DAYMARK · THE LONG GAME</span>
          <span>Progress that leaves room for real life.</span>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="auth-title">
        <Link className={styles.back} href="/">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Daymark
        </Link>

        <div className={styles.card}>
          <div className={styles.cardMark} aria-hidden="true">
            <span>↗</span>
          </div>
          <span className={styles.cardEyebrow}>{copy.eyebrow}</span>
          <h2 id="auth-title" className={styles.cardTitle}>
            {copy.title}
          </h2>
          <p className={styles.intro}>{copy.intro}</p>

          {children}

          <p className={styles.switch}>
            <span>{copy.switchLabel}</span>
            <Link href={mode === "signin" ? "/register" : "/login"}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </Link>
          </p>

          <div className={styles.divider}>
            <span /> OR <span />
          </div>
          <p className={styles.privacy}>{copy.privacy}</p>
        </div>

        <footer className={styles.footer}>
          <span>Private by default.</span>
          <span>Made for the long game.</span>
        </footer>
      </section>
    </main>
  );
}
