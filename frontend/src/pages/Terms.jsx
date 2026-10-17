import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/boat/Header";
import { TermsContent } from "@/components/legal/TermsContent";
import { useAuth } from "@/context/AuthContext";

export default function Terms() {
  const { user } = useAuth();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-16 pt-6" data-testid="terms-page">
      <Link to={user ? "/" : "/login"} className="inline-flex min-h-[44px] items-center gap-2 self-start font-bold text-[var(--blue)] hover:underline" data-testid="terms-back-link">
        <ArrowLeft className="h-4 w-4" /> {user ? "Back to the app" : "Back to sign in"}
      </Link>
      <div className="flex items-center gap-3">
        <BrandMark />
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Terms of Service</h1>
      </div>
      <TermsContent />
    </main>
  );
}
