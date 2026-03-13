import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getOnboardingStep(token: string): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/onboarding/status`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return 5; // API error → don't block, let user through
    const json = await res.json();
    return json.data?.onboardingStep ?? 0;
  } catch {
    return 5; // Network error → don't block
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getToken();
  if (token) {
    const step = await getOnboardingStep(token);
    if (step < 6) {
      const nextStep = Math.min(step + 1, 5);
      redirect(`/onboarding/step/${nextStep}`);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-56 p-4 pt-16 md:p-8 md:pt-8">{children}</main>
    </div>
  );
}
