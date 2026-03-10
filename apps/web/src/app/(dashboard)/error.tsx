"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PayJarvis] Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-56 p-4 pt-16 md:p-8 md:pt-8">
        <div className="flex items-center justify-center py-20">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-4 text-3xl font-bold text-blocked">Erro no Dashboard</div>
            <p className="mb-2 text-gray-300">Nao foi possivel carregar esta pagina.</p>
            <p className="mb-6 text-sm text-gray-500">
              {error.message || "Erro inesperado."}
            </p>
            <button
              onClick={reset}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
