"use client";

import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <span className="mb-6 inline-block rounded-full bg-brand-600/20 px-4 py-1.5 text-sm font-medium text-brand-400">
            {t("landing.badge")}
          </span>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            {t("landing.title")}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400">
            {t("landing.subtitle")}
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/bots/new"
              className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700 transition-colors"
            >
              {t("landing.cta1")}
            </a>
            <a
              href="/dashboard"
              className="rounded-lg border border-gray-700 px-6 py-3 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
            >
              {t("landing.cta2")}
            </a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">
          {t("landing.problemTitle")}
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600">
          {t("landing.problemDesc")}
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: t("landing.problem1Title"), desc: t("landing.problem1Desc") },
            { title: t("landing.problem2Title"), desc: t("landing.problem2Desc") },
            { title: t("landing.problem3Title"), desc: t("landing.problem3Desc") },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-gray-200 p-6">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{card.title}</h3>
              <p className="text-gray-600">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto grid max-w-4xl gap-8 px-6 md:grid-cols-3">
          {[
            { value: t("landing.stat1Value"), label: t("landing.stat1Label"), sub: t("landing.stat1Sub") },
            { value: t("landing.stat2Value"), label: t("landing.stat2Label"), sub: t("landing.stat2Sub") },
            { value: t("landing.stat3Value"), label: t("landing.stat3Label"), sub: t("landing.stat3Sub") },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl font-bold text-brand-600">{stat.value}</div>
              <div className="mt-1 font-medium text-gray-900">{stat.label}</div>
              <div className="text-sm text-gray-500">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
          {t("landing.howTitle")}
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {[
            { step: "1", title: t("landing.step1Title"), desc: t("landing.step1Desc") },
            { step: "2", title: t("landing.step2Title"), desc: t("landing.step2Desc") },
            { step: "3", title: t("landing.step3Title"), desc: t("landing.step3Desc") },
            { step: "4", title: t("landing.step4Title"), desc: t("landing.step4Desc") },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white font-bold">
                {item.step}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Code example */}
      <section className="bg-gray-950 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            {t("landing.codeTitle")}
          </h2>
          <pre className="overflow-x-auto rounded-xl bg-gray-900 p-6 text-sm leading-relaxed text-gray-300">
            <code>{`import { PayJarvis } from "@payjarvis/agent-sdk";

const pj = new PayJarvis({
  apiKey: "pj_bot_...",
  botId: "your-bot-id",
});

const decision = await pj.requestApproval({
  merchant: "AWS",
  amount: 149.99,
  category: "cloud_services",
});

if (decision.approved) {
  // proceed with purchase
} else if (decision.pending) {
  // wait for human approval
  const final = await pj.waitForApproval(decision.approvalId!);
}

// Bot stuck? Ask the owner for help:
const handoff = await pj.requestHandoff({
  sessionUrl: "https://browser.example.com/session/abc",
  obstacleType: "CAPTCHA",
  description: "Captcha on AWS checkout",
});
const result = await pj.waitForHandoff(handoff.handoffId);`}</code>
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
          {t("landing.featuresTitle")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: t("landing.feat1Title"), desc: t("landing.feat1Desc") },
            { title: t("landing.feat2Title"), desc: t("landing.feat2Desc") },
            { title: t("landing.feat3Title"), desc: t("landing.feat3Desc") },
            { title: t("landing.feat4Title"), desc: t("landing.feat4Desc") },
            { title: t("landing.feat5Title"), desc: t("landing.feat5Desc") },
            { title: t("landing.feat6Title"), desc: t("landing.feat6Desc") },
            { title: t("landing.feat7Title"), desc: t("landing.feat7Desc") },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-200 p-6">
              <h3 className="mb-2 font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-4 text-3xl font-bold">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mb-8 text-brand-100">
            {t("landing.ctaDesc")}
          </p>
          <a
            href="/bots/new"
            className="inline-block rounded-lg bg-white px-8 py-3 font-medium text-brand-700 hover:bg-brand-50 transition-colors"
          >
            {t("landing.ctaButton")}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        {t("landing.footer")}
      </footer>
    </main>
  );
}
