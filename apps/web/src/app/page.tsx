export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-brand-900">
          PayJarvis
        </h1>
        <p className="mb-8 text-xl text-gray-600">
          Camada de confiança e identidade para bots de pagamento
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            Dashboard
          </a>
          <a
            href="/docs"
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100 transition-colors"
          >
            Documentação
          </a>
        </div>
      </div>
    </main>
  );
}
