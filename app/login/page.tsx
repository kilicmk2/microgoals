import { auth, signIn } from "@/app/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Microgoals</h1>
        <p className="text-xs font-mono text-neutral-400 mb-8">
          Direction. Clarity. Alignment.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="px-6 py-2.5 bg-black text-white text-sm font-mono rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Sign in with Google
          </button>
        </form>
        <p className="text-[10px] font-mono text-neutral-400 mt-4">
          Restricted to @micro-agi.com accounts
        </p>
      </div>
    </div>
  );
}
