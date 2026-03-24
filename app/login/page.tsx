"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-xs font-mono text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Microgoals</h1>
        <p className="text-xs font-mono text-neutral-400 mb-8">
          Direction. Clarity. Alignment.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="px-6 py-2.5 bg-black text-white text-sm font-mono rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Sign in with Google
        </button>
        <p className="text-[10px] font-mono text-neutral-400 mt-4">
          Restricted to @micro-agi.com accounts
        </p>
      </div>
    </div>
  );
}
