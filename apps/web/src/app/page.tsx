"use client";

import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-surface text-white">
      {/* ─── SECTION 1: HERO ─── */}
      <section className="relative overflow-hidden">
        {/* Layered background: mesh + grid */}
        <div className="absolute inset-0 hero-mesh" />
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
        <div className="relative mx-auto max-w-5xl px-6 py-32 text-center">
          <span className="mb-6 inline-block rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent animate-fade-in">
            {t("landing.badge")}
          </span>
          <h1 className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl opacity-0 animate-fade-in-delay-1">
            {t("landing.title")}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400 opacity-0 animate-fade-in-delay-2">
            {t("landing.subtitle")}
          </p>
          <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row opacity-0 animate-fade-in-delay-3">
            <a
              href="/sign-up"
              className="rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:bg-brand-500 hover:shadow-brand-500/30 hover:scale-[1.03] animate-glow"
            >
              {t("landing.cta1")}
            </a>
            <a
              href="https://github.com/Josepassinato/Payjarvis"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-surface-border px-8 py-3.5 font-semibold text-gray-300 transition-all duration-300 hover:border-gray-500 hover:bg-surface-hover"
            >
              {t("landing.cta2")}
            </a>
          </div>

          {/* Hero flow diagram */}
          <div className="mx-auto flex max-w-lg items-center justify-center gap-3 text-sm sm:gap-5 sm:text-base">
            <div className="rounded-xl border border-surface-border bg-surface-card/80 backdrop-blur-sm px-4 py-3 font-medium text-gray-200 transition-all hover:border-gray-600">
              {t("landing.flowAgent")}
            </div>
            <div className="text-accent/60">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="rounded-xl border border-brand-500/40 bg-brand-600/15 px-4 py-3 font-display font-bold text-gradient-brand">
              PayJarvis
            </div>
            <div className="text-accent/60">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-card/80 backdrop-blur-sm px-4 py-3 font-medium text-gray-200 transition-all hover:border-gray-600">
              {t("landing.flowMerchant")}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: THE PROBLEM ─── */}
      <section className="border-t border-surface-border/50">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="mb-4 text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.problemTitle")}
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-lg text-gray-400">
            {t("landing.problemDesc")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              t("landing.can1"),
              t("landing.can2"),
              t("landing.can3"),
              t("landing.can4"),
              t("landing.can5"),
            ].map((item, i) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3 transition-all duration-200 hover:border-brand-500/30 hover:bg-surface-hover group" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="text-accent group-hover:text-accent-light transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <span className="text-sm text-gray-300">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl border-l-2 border-l-blocked border border-blocked/15 bg-blocked/5 p-6">
            <p className="text-lg text-gray-300 text-center">
              {t("landing.problemWarning")}
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: THE SOLUTION ─── */}
      <section className="border-t border-surface-border/50 bg-surface-card/30">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="mb-4 text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.solutionTitle")}
          </h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-gray-400">
            {t("landing.solutionDesc")}
          </p>

          {/* Vertical flow diagram */}
          <div className="mx-auto mb-14 flex max-w-xs flex-col items-center gap-2">
            <div className="w-full rounded-xl border border-surface-border bg-surface-card px-6 py-4 text-center font-medium">
              {t("landing.flowAgent")}
            </div>
            <div className="w-px h-6 bg-gradient-to-b from-surface-border to-brand-500/40" />
            <div className="w-full rounded-xl border border-brand-500/40 bg-brand-600/10 px-6 py-4 text-center font-display font-bold text-gradient-brand shadow-lg shadow-brand-600/10">
              PayJarvis
            </div>
            <div className="w-px h-6 bg-gradient-to-b from-brand-500/40 to-surface-border" />
            <div className="w-full rounded-xl border border-surface-border bg-surface-card px-6 py-4 text-center font-medium">
              {t("landing.flowTarget")}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: t("landing.sol1Title"), desc: t("landing.sol1Desc"), accent: "from-brand-500/10" },
              { title: t("landing.sol2Title"), desc: t("landing.sol2Desc"), accent: "from-accent/10" },
              { title: t("landing.sol3Title"), desc: t("landing.sol3Desc"), accent: "from-purple-500/10" },
              { title: t("landing.sol4Title"), desc: t("landing.sol4Desc"), accent: "from-amber-500/10" },
            ].map((card) => (
              <div key={card.title} className={`rounded-xl border border-surface-border bg-gradient-to-br ${card.accent} to-transparent p-5 transition-all duration-200 hover:border-surface-hover hover:translate-y-[-2px]`}>
                <h3 className="mb-2 font-display font-semibold text-white">{card.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: AI AGENT TRUST SCORE ─── */}
      <section className="border-t border-surface-border/50">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="mb-4 text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.trustTitle")}
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-gray-400">
            {t("landing.trustDesc")}
          </p>

          <div className="grid items-start gap-10 lg:grid-cols-2">
            {/* Trust score factors */}
            <div className="space-y-3">
              {[
                { label: t("landing.trust1"), color: "text-approved" },
                { label: t("landing.trust2"), color: "text-approved" },
                { label: t("landing.trust3"), color: "text-brand-400" },
                { label: t("landing.trust4"), color: "text-pending" },
                { label: t("landing.trust5"), color: "text-purple-400" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-card px-5 py-3.5 transition-all duration-200 hover:border-surface-hover hover:bg-surface-hover">
                  <span className={item.color}>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Trust score card mock */}
            <div className="mx-auto w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-8 shadow-2xl shadow-brand-900/20">
              <div className="mb-1 text-sm text-gray-500 font-mono uppercase tracking-wider">{t("landing.trustCardLabel")}</div>
              <div className="mb-6 text-6xl font-display font-bold text-gradient-brand">720</div>
              {/* Score bar */}
              <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-brand-600 via-brand-400 to-accent transition-all duration-1000" />
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-approved" />
                  <span className="text-gray-400">{t("landing.trustHigh")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-pending" />
                  <span className="text-gray-400">{t("landing.trustLow")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: DEMO EXAMPLES ─── */}
      <section className="border-t border-surface-border/50 bg-surface-card/30">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="mb-14 text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.demoTitle")}
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Blocked example */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6 transition-all duration-200 hover:border-surface-hover">
              <div className="mb-4 text-xs text-gray-500 font-mono uppercase tracking-wider">{t("landing.demoScenario1")}</div>
              <div className="mb-6 text-gray-300">{t("landing.demoDesc1")}</div>
              <div className="rounded-xl border-l-2 border-l-blocked border border-blocked/20 bg-blocked/5 p-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blocked" />
                  <span className="font-display font-bold text-blocked">{t("landing.demoBlocked")}</span>
                </div>
                <div className="text-sm text-red-300/60">{t("landing.demoBlockedReason")}</div>
              </div>
            </div>

            {/* Approved example */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6 transition-all duration-200 hover:border-surface-hover">
              <div className="mb-4 text-xs text-gray-500 font-mono uppercase tracking-wider">{t("landing.demoScenario2")}</div>
              <div className="mb-6 text-gray-300">{t("landing.demoDesc2")}</div>
              <div className="rounded-xl border-l-2 border-l-approved border border-approved/20 bg-approved/5 p-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-approved" />
                  <span className="font-display font-bold text-approved">{t("landing.demoApproved")}</span>
                </div>
                <div className="text-sm text-green-300/60">{t("landing.demoApprovedReason")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: FOR DEVELOPERS ─── */}
      <section className="border-t border-surface-border/50">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <h2 className="mb-4 text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.devTitle")}
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-gray-400">
            {t("landing.devDesc")}
          </p>
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-2xl shadow-black/30">
            {/* Code window header */}
            <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-blocked/60" />
              <span className="h-3 w-3 rounded-full bg-pending/60" />
              <span className="h-3 w-3 rounded-full bg-approved/60" />
              <span className="ml-3 text-xs text-gray-600 font-mono">agent.ts</span>
            </div>
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed font-mono">
              <code><span className="code-keyword">{"import"}</span>{" { "}<span className="code-type">{"PayJarvis"}</span>{" } "}<span className="code-keyword">{"from"}</span>{" "}<span className="code-string">{'"@payjarvis/agent-sdk"'}</span>{"\n\n"}<span className="code-keyword">{"const"}</span>{" pj = "}<span className="code-type">{"PayJarvis"}</span>{"."}<span className="code-function">{"fromEnv"}</span>{"()\n\n"}<span className="code-keyword">{"const"}</span>{" decision = "}<span className="code-keyword">{"await"}</span>{" pj."}<span className="code-function">{"authorize"}</span>{"({\n  merchant: "}<span className="code-string">{'"Amazon"'}</span>{",\n  amount: "}<span className="text-amber-300">{"120"}</span>{",\n  category: "}<span className="code-string">{'"electronics"'}</span>{"\n})\n\n"}<span className="code-keyword">{"if"}</span>{" (decision.approved) {\n  "}<span className="code-function">{"completePurchase"}</span>{"()\n}"}</code>
            </pre>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="text-accent font-mono text-sm">$</span>
            <code className="text-sm text-gray-400 font-mono">npm install @payjarvis/agent-sdk</code>
          </div>
        </div>
      </section>

      {/* ─── SECTION 7: FUTURE OF AI COMMERCE ─── */}
      <section className="border-t border-surface-border/50 bg-surface-card/30">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="mb-4 text-center font-display text-3xl font-bold sm:text-4xl">
            {t("landing.futureTitle")}
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-gray-400">
            {t("landing.futureDesc")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: t("landing.future1Title"), desc: t("landing.future1Desc") },
              { title: t("landing.future2Title"), desc: t("landing.future2Desc") },
              { title: t("landing.future3Title"), desc: t("landing.future3Desc") },
              { title: t("landing.future4Title"), desc: t("landing.future4Desc") },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-surface-border bg-surface-card p-5 text-center transition-all duration-200 hover:border-surface-hover hover:translate-y-[-2px]">
                <h3 className="mb-2 font-display font-semibold text-white">{card.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative border-t border-brand-500/20 overflow-hidden">
        <div className="absolute inset-0 hero-mesh opacity-70" />
        <div className="relative mx-auto max-w-2xl px-6 py-20 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold sm:text-4xl">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mb-8 text-lg text-gray-400">
            {t("landing.ctaDesc")}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/sign-up"
              className="rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:bg-brand-500 hover:scale-[1.03] animate-glow"
            >
              {t("landing.ctaButton")}
            </a>
            <a
              href="https://github.com/Josepassinato/Payjarvis"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-surface-border px-8 py-3.5 font-semibold text-gray-300 transition-all duration-300 hover:border-gray-500 hover:bg-surface-hover"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-surface-border/50 py-8 text-center text-sm text-gray-600">
        {t("landing.footer")}
      </footer>
    </main>
  );
}
