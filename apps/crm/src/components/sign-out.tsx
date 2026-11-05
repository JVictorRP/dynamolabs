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
      className="footer-line hover:!text-white"
    >
      Sair
    </button>
  );
}
