import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="hero-mesh fixed inset-0 pointer-events-none" />
      <div className="grid-pattern fixed inset-0 pointer-events-none opacity-30" />
      <div className="relative animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-gradient-brand">PayJarvis</h1>
          <p className="text-gray-400 mt-2 font-body text-sm">Bot Payment Identity</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-surface-card border border-surface-border shadow-xl",
              headerTitle: "text-white font-display",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "bg-surface border border-surface-border hover:bg-surface-hover text-white",
              socialButtonsBlockButtonText: "text-white font-medium",
              formFieldLabel: "text-gray-300",
              formFieldInput: "bg-surface border-surface-border text-white placeholder-gray-500",
              footerActionLink: "text-brand-400 hover:text-brand-500",
              formButtonPrimary: "bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/20",
              dividerLine: "bg-surface-border",
              dividerText: "text-gray-500",
              identityPreviewText: "text-white",
              identityPreviewEditButton: "text-brand-400",
              formFieldAction: "text-brand-400",
              alert: "bg-red-500/10 border-red-500/30 text-red-400",
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
