/**
 landing page for unauthenticated users

 showcase the product, features and redirects signed users to dashboard
 */

 "use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Zap,
  Mail,
  Target,
  TrendingUp,
  Bell,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";


// Marketing feature cards rendered in the landing grid.
// Keeping them as data makes the section easy to extend later.
const FEATURES = [
  {
    icon: Mail,
    title: "Auto-detects from Gmail",
    desc:
      "Connect your inbox once. Every confirmation email is captured automatically — no manual logging.",
    colour: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Target,
    title: "Daily & weekly targets",
    desc:
      "Set the number of applications you commit to. The app tracks progress in real time against your goal.",
    colour: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: Bell,
    title: "Smart notifications",
    desc:
      "Four escalating time windows — gentle at midnight, intense by evening — keep you on track all day.",
    colour: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: TrendingUp,
    title: "Streaks & history",
    desc:
      "Heatmap calendar, weekly charts, and streak tracking make your consistency visible.",
    colour: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Zap,
    title: "Consequences system",
    desc:
      "Miss your target? Face the shame screen. Carry-over keeps debt visible. Recovery earns a badge.",
    colour: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    icon: Shield,
    title: "Read-only Gmail access",
    desc:
      "We only read email metadata — subject and sender. Never the body. Your privacy is non-negotiable.",
    colour: "text-teal-400",
    bg: "bg-teal-400/10",
  },
] as const;

// Small trust indicators shown below the primary CTA
const SOCIAL_PROOF = [
  "No password required",
  "Works on mobile and desktop",
  "Free to use",
] as const;

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Skip the landing page entirely for authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  function handleLogin() {
    // Start the Google OAuth flow through the backend.
    // The backend handles authentication and redirects
    // back to the dashboard after success.
    window.location.href =
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
  }

  // Prevent the landing page flashing before redirecting
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div
          className="h-8 w-8 animate-spin rounded-full
                     border-2 border-gray-700 border-t-gray-300"
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">

      {/* Top navigation */}
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between
                   px-6 py-5"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-400" />
          <span className="text-lg font-bold">JobPulse</span>
        </div>

        <button
          onClick={handleLogin}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold
                     text-gray-900 transition hover:bg-gray-100"
        >
          Sign in with Google
        </button>
      </nav>

      {/* Hero section */}
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center">

        {/* Product badge */}
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full
                     border border-gray-800 bg-gray-900 px-4 py-1.5
                     text-sm text-gray-400"
        >
          <span className="h-2 w-2 rounded-full bg-green-400" />
          AI-powered job application tracker
        </div>

        <h1
          className="mb-6 text-5xl font-extrabold tracking-tight
                     sm:text-6xl lg:text-7xl"
        >
          Stop losing track of{" "}

          <span
            className="bg-gradient-to-r from-amber-400 to-orange-400
                       bg-clip-text text-transparent"
          >
            every application
          </span>
        </h1>

        <p
          className="mx-auto mb-10 max-w-2xl text-lg
                     leading-relaxed text-gray-400"
        >
          JobPulse reads your Gmail, counts every job application
          automatically, and holds you accountable to your daily target
          with escalating notifications — so you never lose momentum
          in your job search.
        </p>

        {/* Primary CTA */}
        <div
          className="flex flex-col items-center gap-4
                     sm:flex-row sm:justify-center"
        >
          <button
            onClick={handleLogin}
            className="group flex items-center gap-2 rounded-xl
                       bg-amber-400 px-8 py-4 text-base font-bold
                       text-gray-900 transition hover:bg-amber-300"
          >
            Get started free

            <ArrowRight
              className="h-5 w-5 transition-transform
                         group-hover:translate-x-1"
            />
          </button>

          <p className="text-sm text-gray-500">
            No credit card · Sign in with Google
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {SOCIAL_PROOF.map((text) => (
            <div
              key={text}
              className="flex items-center gap-1.5 text-sm text-gray-500"
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-6 pb-32">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Everything you need to stay consistent
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, colour, bg }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-800 bg-gray-900
                         p-6 transition hover:border-gray-700"
            >
              <div className={`mb-4 inline-flex rounded-xl p-3 ${bg}`}>
                <Icon className={`h-6 w-6 ${colour}`} />
              </div>

              <h3 className="mb-2 text-base font-semibold text-white">
                {title}
              </h3>

              <p className="text-sm leading-relaxed text-gray-400">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        className="border-t border-gray-800 bg-gray-900
                   py-24 text-center"
      >
        <h2 className="mb-4 text-3xl font-bold">
          Ready to take your job search seriously?
        </h2>

        <p className="mb-8 text-gray-400">
          Connect your Gmail and set your first target in under 2 minutes.
        </p>

        <button
          onClick={handleLogin}
          className="group inline-flex items-center gap-2 rounded-xl
                     bg-amber-400 px-8 py-4 text-base font-bold
                     text-gray-900 transition hover:bg-amber-300"
        >
          Start tracking for free

          <ArrowRight
            className="h-5 w-5 transition-transform
                       group-hover:translate-x-1"
          />
        </button>
      </section>

    </main>
  );
}