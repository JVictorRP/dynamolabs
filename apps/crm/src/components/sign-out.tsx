"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
      }}
      className="text-xs text-ink-500 hover:text-ink-100"
    >
      Sair
    </button>
  );
}
