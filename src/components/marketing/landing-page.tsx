import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  Heart,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Users,
} from "lucide-react";
import { DaymarkMark } from "@/components/brand/daymark-mark";
import { DemoCheckin } from "@/components/marketing/demo-checkin";
import { LandingNav } from "@/components/marketing/landing-nav";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

const OPENING_THOUGHTS = [
  "The quiet work is still work. Begin with the next small act.",
  "Keep one promise to yourself, then make room for the next.",
  "A missed step is not the end of the path. Return to it.",
];

const CALENDAR_STATUSES = [
  "blank",
  "",
  "done",
  "done",
  "skip",
  "done",
  "",
  "",
  "done",
  "done",
  "done",
  "",
  "done",
  "",
  "done",
  "skip",
  "done",
  "done",
  "",
  "done",
  "done",
  "",
  "done",
  "done",
  "done",
  "skip",
  "done",
  "done",
  "",
  "done",
  "",
  "done",
  "done",
  "done",
  "",
  "done",
];

const PHOTO_CREDITS = [
  {
    label: "Runner photo",
    photographer: "Filip Mroz",
    href: "https://unsplash.com/photos/sgtxFOiBZmQ",
  },
  {
    label: "Strength photo",
    photographer: "Samuel Girven",
    href: "https://unsplash.com/photos/rFuPln3EARk",
  },
  {
    label: "Food photo",
    photographer: "Leanna Myers",
    href: "https://unsplash.com/photos/U5goTEzbOzU",
  },
];

function getDailyThought() {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const sum = [...dayKey].reduce((total, char) => total + char.charCodeAt(0), 0);
  return OPENING_THOUGHTS[sum % OPENING_THOUGHTS.length];
}

function calendarClassName(status: string) {
  return cn(
    styles.calendarDay,
    status === "done" && styles.calendarDone,
    status === "skip" && styles.calendarSkip,
    status === "blank" && styles.calendarBlank
  );
}

export function LandingPage() {
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>

      <div className={styles.announcement}>
        <Sparkles className="size-3.5 shrink-0 text-lime" aria-hidden="true" />
        <span>Private by default. Consistent by design.</span>
        <a href="#privacy">
          See the approach <ArrowRight className="size-3" aria-hidden="true" />
        </a>
      </div>

      <LandingNav />

      <main id="main-content">
        <section className={cn(styles.sectionWrap, styles.hero)}>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>
                <span className={styles.kickerLine} aria-hidden="true" />
                A practice for real life
              </p>
              <h1 className={styles.heroTitle}>
                Show up.
                <br />
                <em>Again.</em>
              </h1>
              <p className={styles.heroLead}>
                Build steadier days with movement, strength, nourishing food,
                and focus. Daymark keeps check-ins quick and your history
                honest—without pretending every day will be perfect.
              </p>
              <div className={styles.heroActions}>
                <Button asChild size="lg" className="h-11 px-5 text-sm">
                  <Link href="/register">
                    Start tracking
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 px-5 text-sm"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
              <p className={styles.heroPromise}>
                <ShieldCheck className="size-4 text-[var(--color-complete)]" aria-hidden="true" />
                Private by default · Offline-ready · No public profiles
              </p>
            </div>

            <div
              className={styles.heroStage}
              aria-label="Illustrative Daymark daily habit tracking view"
            >
              <div className={styles.heroPhoto}>
                <Image
                  src="/images/landing/runner.jpg"
                  alt="A woman running along a path near the ocean"
                  fill
                  preload
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className={styles.sunNote}>
                <Sun className="size-4" aria-hidden="true" />
                <span>
                  One day.
                  <br />
                  One promise.
                </span>
              </div>
              <div className={styles.todayCard}>
                <p className={styles.previewLabel}>
                  <span className={cn(styles.liveDot, "size-1.5 rounded-full bg-current")} />
                  Today, at your pace
                </p>
                <div className={styles.todayCardHead}>
                  <div>
                    <p className={styles.overline}>Your practice</p>
                    <h3>Today</h3>
                  </div>
                  <div className={styles.progressRing} aria-hidden="true">
                    2/4
                  </div>
                </div>
                <div className={styles.miniHabits}>
                  {["Run or walk", "Strength session", "Build a balanced plate"].map(
                    (title, index) => (
                      <div key={title} className={styles.miniHabit}>
                        <span
                          className={cn(
                            styles.miniCheck,
                            index !== 1 && styles.miniCheckDone
                          )}
                          aria-hidden="true"
                        >
                          {index !== 1 ? (
                            <Check className="size-2.5" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span className={styles.miniHabitName}>{title}</span>
                      </div>
                    )
                  )}
                </div>
                <p className={styles.previewFootnote}>
                  Illustrative view · Your real data stays private
                </p>
              </div>
              <div className={styles.heroStamp} aria-hidden="true">
                <span>show up</span>
                <span>with intent</span>
                <Heart className={cn(styles.heroStampHeart, "mx-auto mt-1 size-3")} />
              </div>
            </div>
          </div>

          <a className={styles.scrollCue} href="#practice">
            <span aria-hidden="true" />
            Scroll to explore
          </a>
        </section>

        <section className={styles.valueStrip} aria-label="Daymark principles">
          <div className={cn(styles.sectionWrap, styles.valueInner)}>
            <div className={styles.valueItem}>
              <span className={styles.valueSymbol}>
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              Routines that fit real life
            </div>
            <span className={styles.valueDivider} aria-hidden="true" />
            <div className={styles.valueItem}>
              <span className={styles.valueSymbol}>
                <Activity className="size-4" aria-hidden="true" />
              </span>
              Progress you can see
            </div>
            <span className={styles.valueDivider} aria-hidden="true" />
            <div className={styles.valueItem}>
              <span className={styles.valueSymbol}>
                <Heart className="size-4" aria-hidden="true" />
              </span>
              Accountability without shame
            </div>
          </div>
        </section>

        <section id="practice" className={styles.training}>
          <div className={cn(styles.sectionWrap)}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              The practice is the point
            </p>
            <h2 className={styles.sectionTitle}>
              Move with intent.
              <br />
              <em>Fuel the long game.</em>
            </h2>
            <p className={styles.sectionLead}>
              Running, strength, and nourishing food are not 30-day challenges;
              they are practices. Daymark helps turn intention into a rhythm you
              can return to.
            </p>

            <div className={styles.trainingGrid}>
              <article className={styles.trainingCard}>
                <Image
                  src="/images/landing/strength.jpg"
                  alt="A person lifting a dumbbell in a gym"
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
                <span className={styles.trainingOverlay} aria-hidden="true" />
                <div className={styles.trainingCaption}>
                  <span>
                    <Dumbbell className="size-3.5" aria-hidden="true" />
                    01 / Strength
                  </span>
                  <h3>
                    The quiet reps
                    <br />
                    count.
                  </h3>
                  <p>Make effort repeatable. Let progress take its time.</p>
                </div>
              </article>

              <article className={styles.trainingCard}>
                <Image
                  src="/images/landing/nourish.jpg"
                  alt="A bowl of rice and vegetables"
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
                <span className={styles.trainingOverlay} aria-hidden="true" />
                <div className={styles.trainingCaption}>
                  <span>
                    <Leaf className="size-3.5" aria-hidden="true" />
                    02 / Nourish
                  </span>
                  <h3>
                    Fuel, not
                    <br />
                    punishment.
                  </h3>
                  <p>Choose food that supports your day and your wellbeing.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={cn(styles.sectionWrap, styles.split)}>
          <div>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              One day, one clear plan
            </p>
            <h2 className={styles.sectionTitle}>
              No perfect streak.
              <br />
              <em>Just repeatable work.</em>
            </h2>
            <p className={styles.sectionLead}>
              Start with what matters today. Quick check-ins keep the daily step
              simple, then your history shows the bigger picture.
            </p>
            <ul className={styles.featureList}>
              {[
                "One-tap, count, or timer check-ins",
                "Flexible schedules and weekly targets",
                "A missed day never erases your effort",
              ].map((feature) => (
                <li key={feature}>
                  <span className={styles.checkDot}>
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="#progress" className={styles.arrowLink}>
              See the bigger picture <ArrowRight className="size-4" />
            </Link>
          </div>
          <DemoCheckin />
        </section>

        <section className={styles.cadence}>
          <div className={styles.sectionWrap}>
            <div className={styles.cadenceHead}>
              <div>
                <p className={styles.eyebrow}>
                  <span className={styles.eyebrowDot} aria-hidden="true" />
                  Built for the long game
                </p>
                <h2 className={styles.sectionTitle}>
                  Structure that
                  <br />
                  <em>leaves room.</em>
                </h2>
              </div>
              <p className={styles.sectionLead}>
                Discipline is not doing everything every day. Choose a cadence
                that is challenging and sustainable, then adjust it as life
                changes.
              </p>
            </div>

            <div className={styles.cadenceGrid}>
              <article className={cn(styles.cadenceCard, styles.cadenceCardDark)}>
                <div className={styles.cadenceTop}>
                  <span>01</span>
                  <Sun className="size-4" aria-hidden="true" />
                </div>
                <h3>Daily practice</h3>
                <p>A small ritual with space for a rest day.</p>
                <div className={styles.cadenceVisual} aria-label="Seven-day rhythm">
                  {[true, true, true, "soft", true, false, false].map((state, index) => (
                    <span
                      key={index}
                      className={cn(
                        styles.weekDot,
                        state === true && styles.weekDotFilled,
                        state === "soft" && styles.weekDotSoft
                      )}
                    />
                  ))}
                </div>
              </article>

              <article className={styles.cadenceCard}>
                <div className={styles.cadenceTop}>
                  <span>02</span>
                  <CalendarDays className="size-4" aria-hidden="true" />
                </div>
                <h3>Selected days</h3>
                <p>Pick the days that fit your actual week.</p>
                <div className={styles.cadenceVisual} aria-label="Example selected weekdays">
                  {([
                    ["M", false],
                    ["W", true],
                    ["F", false],
                    ["S", true],
                  ] as const).map(([day, selected]) => (
                    <span
                      key={day}
                      className={cn(
                        styles.weekdayPill,
                        selected && styles.weekdayPillSelected
                      )}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </article>

              <article className={styles.cadenceCard}>
                <div className={styles.cadenceTop}>
                  <span>03</span>
                  <Activity className="size-4" aria-hidden="true" />
                </div>
                <h3>Weekly target</h3>
                <p>Steady progress without chasing a daily streak.</p>
                <div className={styles.cadenceVisual}>
                  <span className={cn(styles.targetDot, styles.targetDotFilled)} />
                  <span className={cn(styles.targetDot, styles.targetDotFilled)} />
                  <span className={styles.targetDot} />
                  <span className={styles.targetDot} />
                  <span className={styles.targetLabel}>2 / 4 this week</span>
                </div>
              </article>

              <article className={cn(styles.cadenceCard, styles.cadenceCardAccent)}>
                <div className={styles.cadenceTop}>
                  <span>04</span>
                  <Timer className="size-4" aria-hidden="true" />
                </div>
                <h3>Count or time</h3>
                <p>Track minutes, pages, reps, glasses, or what matters to you.</p>
                <div className={styles.quantityExample}>
                  <span>Read</span>
                  <strong>
                    10 <small>pages</small>
                  </strong>
                  <ArrowRight className="ml-auto size-4" aria-hidden="true" />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="ritual" className={cn(styles.sectionWrap, styles.split)}>
          <div>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              A moment before the momentum
            </p>
            <h2 className={styles.sectionTitle}>
              Start with one clear
              <br />
              <em>thought.</em>
            </h2>
            <p className={styles.sectionLead}>
              A daily opening thought can set the tone without becoming another
              obligation.
            </p>
            <Link href="#practice" className={styles.arrowLink}>
              Then make your next move <ArrowRight className="size-4" />
            </Link>
          </div>

          <article className={styles.openingCard}>
            <div className={styles.openingCardTop}>
              <span className={styles.openingLabel}>
                <Sparkles className="size-3.5" aria-hidden="true" />
                Today&apos;s opening thought
              </span>
              <span>{todayLabel}</span>
            </div>
            <blockquote>“{getDailyThought()}”</blockquote>
            <div className={styles.openingAttribution}>
              <span>{APP_NAME}</span>
              <span>Original daily reflection</span>
            </div>
            <p className={styles.openingNote}>
              Rotates with the calendar day. Not a historical quotation.
            </p>
          </article>
        </section>

        <section id="progress" className={cn(styles.sectionWrap, styles.split)}>
          <div>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              The whole picture
            </p>
            <h2 className={styles.sectionTitle}>
              A missed day is a moment.
              <br />
              <em>Not your whole story.</em>
            </h2>
            <p className={styles.sectionLead}>
              See your real pattern in a calendar and trends. Keep the progress
              you have made, adjust your rhythm, and pick up where you are.
            </p>
            <div className={styles.progressPoints}>
              <div className={styles.progressPoint}>
                <span className={styles.pointIcon}>
                  <CalendarDays className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <strong>History, not just streaks</strong>
                  <small>
                    Look back at completed, partial, missed, and open days.
                  </small>
                </div>
              </div>
              <div className={styles.progressPoint}>
                <span className={cn(styles.pointIcon, styles.pointIconCoral)}>
                  <Heart className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <strong>Room to reset</strong>
                  <small>Change your schedule without losing your past effort.</small>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.historyCard}>
            <div className={styles.historyHeader}>
              <div>
                <p className={styles.overline}>Your practice</p>
                <h3>More steady, in your own way</h3>
              </div>
              <span className={styles.periodPill}>
                Last 4 weeks <ChevronDown className="size-3" aria-hidden="true" />
              </span>
            </div>

            <div className={styles.calendar}>
              <div className={styles.calendarHead}>
                <span>Your recent weeks</span>
                <span>Illustrative view</span>
              </div>
              <div className={styles.calendarWeekdays} aria-hidden="true">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div
                className={styles.calendarDays}
                role="img"
                aria-label="Illustrative completion calendar with steady completed days and a few skipped days"
              >
                {CALENDAR_STATUSES.map((status, index) => (
                  <span
                    key={index}
                    className={calendarClassName(status)}
                    aria-hidden="true"
                  >
                    {status === "blank" ? "" : index + 1}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.trend}>
              <div>
                <p className={styles.overline}>Your check-ins</p>
                <strong>Consistency, built your way</strong>
              </div>
              <svg viewBox="0 0 180 48" role="img" aria-label="Illustrative rising trend">
                <path
                  className={styles.trendFill}
                  d="M0 40 C18 32 23 36 36 30 S56 34 70 22 S92 31 105 18 S127 23 140 13 S161 14 180 4 V48 H0Z"
                />
                <path
                  className={styles.trendLine}
                  d="M0 40 C18 32 23 36 36 30 S56 34 70 22 S92 31 105 18 S127 23 140 13 S161 14 180 4"
                />
              </svg>
            </div>
            <p className={styles.illustrationNote}>
              Illustrative history · sample data only
            </p>
          </div>
        </section>

        <section id="privacy" className={styles.privacy}>
          <div className={styles.sectionWrap}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Your space, your choice
            </p>
            <h2 className={styles.sectionTitle}>
              Strong habits need
              <br />
              strong <em>boundaries.</em>
            </h2>
            <p className={styles.sectionLead}>
              Daymark starts with you. Sharing is an invitation—not the price of
              using the app.
            </p>
            <Link href="#community" className={styles.lightLink}>
              Explore community safeguards <ArrowRight className="size-4" />
            </Link>

            <div className={styles.privacyGrid}>
              <article className={styles.privacyCard}>
                <span className={styles.privacyIcon}>
                  <LockKeyhole className="size-4" aria-hidden="true" />
                </span>
                <h3>Private comes first</h3>
                <p>
                  Your habits, notes, and check-ins are yours unless you decide
                  otherwise.
                </p>
                <span className={styles.privacyNote}>Default: just you</span>
              </article>

              <article className={styles.privacyCard}>
                <span className={styles.privacyIcon}>
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <h3>Choose what to share</h3>
                <p>
                  Grant a partner or circle access to specific fields, with
                  invites by exact email.
                </p>
                <span className={styles.privacyNote}>Granular by design</span>
              </article>

              <article className={cn(styles.privacyCard, styles.privacyCardWide)}>
                <span className={cn(styles.privacyIcon, styles.privacyIconCoral)}>
                  <Heart className="size-4" aria-hidden="true" />
                </span>
                <h3>Encouragement, not pressure</h3>
                <p>
                  No leaderboards, no public missed-day alerts, and no group
                  penalties. Support counts stay anonymous.
                </p>
                <span className={styles.privacyNote}>A gentler accountability</span>
              </article>
            </div>
          </div>
        </section>

        <section id="community" className={cn(styles.sectionWrap, styles.split)}>
          <div>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Community with guardrails
            </p>
            <h2 className={styles.sectionTitle}>
              Good company.
              <br />
              <em>Clear boundaries.</em>
            </h2>
            <p className={styles.sectionLead}>
              Public discovery is for signed-in members only, and challenges
              appear only after a moderator approves them. There are no public
              profiles, user search, direct messages, leaderboards, participant
              names, or progress feeds.
            </p>

            <div className={styles.modeList}>
              {[
                {
                  title: "Just you",
                  detail: "Your complete, private tracker.",
                },
                {
                  title: "Trusted partner",
                  detail: "Invite by exact email and share only what you choose.",
                },
                {
                  title: "Private circle",
                  detail: "Invite-only membership, field-level grants, and anonymous support counts.",
                },
              ].map((mode, index) => (
                <div key={mode.title} className={styles.mode}>
                  <span className={styles.modeNumber}>
                    0{index + 1}
                  </span>
                  <div>
                    <strong>{mode.title}</strong>
                    <small>{mode.detail}</small>
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.guardrailNote}>
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Discovery is opt-in and moderation-gated.
            </p>
          </div>

          <div className={styles.communityCard}>
            <div className={styles.communityCardHead}>
              <div>
                <p className={styles.overline}>Private circle</p>
                <h3>Sunday reset club</h3>
              </div>
              <span className={styles.lockLabel}>
                <LockKeyhole className="size-3" aria-hidden="true" />
                Invite only
              </span>
            </div>
            <p className={styles.circleDescription}>
              An illustrative circle showing how field-level sharing works.
            </p>
            <div className={styles.members}>
              <span className={styles.avatar}>M</span>
              <span className={cn(styles.avatar, styles.avatarCoral)}>J</span>
              <span className={cn(styles.avatar, styles.avatarSage)}>Y</span>
              <span className={styles.membersCopy}>
                <strong>3 people</strong>
                <small>Invited by exact email</small>
              </span>
            </div>
            <div className={styles.activity}>
              <span className={cn(styles.avatar, styles.avatarSage)}>M</span>
              <span className={styles.activityCopy}>
                <strong>Maya checked in</strong>
                <small>Make a little space to reset</small>
              </span>
              <span className={styles.reaction}>
                <Heart className="size-3" fill="currentColor" aria-hidden="true" />
                2
              </span>
            </div>
            <div className={styles.activity}>
              <span className={cn(styles.avatar, styles.avatarSage)}>Y</span>
              <span className={styles.activityCopy}>
                <strong>Your Sunday walk</strong>
                <small>Shared with Sunday reset club</small>
              </span>
              <ShieldCheck className="size-4 text-[var(--color-complete)]" aria-hidden="true" />
            </div>
            <p className={styles.circleNote}>
              <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Names are visible only inside a circle you joined. Support counts
              stay anonymous.
            </p>
          </div>
        </section>

        <section className={styles.stages}>
          <div className={styles.sectionWrap}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Built one good step at a time
            </p>
            <h2 className={styles.sectionTitle}>
              The Daymark approach,
              <br />
              <em>in stages.</em>
            </h2>
            <p className={styles.sectionLead}>
              Each layer earns trust before it asks for more.
            </p>

            <div className={styles.stageGrid}>
              {[
                {
                  number: "01",
                  status: "The foundation",
                  title: "Make daily progress feel doable",
                  body: "Flexible habits, quick check-ins, reminders, clear history, and gentle recovery.",
                  label: "Available today",
                },
                {
                  number: "02",
                  status: "Share deliberately",
                  title: "Bring in your people",
                  body: "Partners and invite-only circles, with sharing you control field by field.",
                  label: "Private by default",
                },
                {
                  number: "03",
                  status: "Discover safely",
                  title: "Open the door carefully",
                  body: "Signed-in, moderation-gated challenges with no public profiles or rankings.",
                  label: "Gated and opt-in",
                },
              ].map((stage) => (
                <article key={stage.number} className={styles.stageCard}>
                  <div className={styles.stageTop}>
                    <span>{stage.number}</span>
                    <span>{stage.status}</span>
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.body}</p>
                  <span className={styles.stageLabel}>{stage.label}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(styles.sectionWrap, styles.finalCta)}>
          <p className={styles.eyebrow} style={{ justifyContent: "center" }}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            A note from {APP_NAME}
          </p>
          <h2 className={styles.sectionTitle}>
            There&apos;s no perfect streak.
            <br />
            <em>There&apos;s the work you return to.</em>
          </h2>
          <p>
            Start with one habit, one check-in, and a place to see the pattern.
            Your data stays yours.
          </p>
          <div className={styles.finalActions}>
            <Button asChild size="lg" className="h-11 px-5 text-sm">
              <Link href="/register">
                Create your account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className={cn("h-11 px-5 text-sm", styles.lightOutline)}
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.sectionWrap}>
          <div className={styles.footerTop}>
            <div>
              <Link href="/" className={styles.brand} aria-label="Daymark home">
                <DaymarkMark className="size-8" />
                <span>daymark</span>
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">Show up. Again.</p>
            </div>
            <div className={styles.footerLinks}>
              <Link href="#privacy">Privacy-first by design</Link>
              <Link href="#community">Community safeguards</Link>
              <Link href="#practice">The practice</Link>
            </div>
          </div>

          <details className={styles.credits}>
            <summary>Photo credits and license</summary>
            <ul>
              {PHOTO_CREDITS.map((credit) => (
                <li key={credit.href}>
                  {credit.label}:{" "}
                  <a href={credit.href} target="_blank" rel="noreferrer">
                    {credit.photographer}
                  </a>
                </li>
              ))}
              <li>
                Photos used under the{" "}
                <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
                  Unsplash License
                </a>
                .
              </li>
            </ul>
          </details>

          <div className={styles.footerBottom}>
            <span>
              © {new Date().getFullYear()} {APP_NAME}
            </span>
            <span>Made for the days you show up—and the days you return.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
