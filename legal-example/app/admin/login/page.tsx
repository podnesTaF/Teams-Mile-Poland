import { Suspense } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const metadata = { title: "Logowanie — Panel administratora ACE BATTLE RUN" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4 font-body text-brand-text">
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
