"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PayJarvis] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-4xl font-bold text-blocked">Erro</div>
        <p className="mb-2 text-lg text-gray-300">Algo deu errado.</p>
        <p className="mb-6 text-sm text-gray-500">
          {error.message || "Erro inesperado na aplicacao."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
