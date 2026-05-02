"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import { checkoutItems } from "@/app/lib/shop-catalog";

export default function SuccessPage() {
  return (
    <Suspense fallback={<main className="cm-page grid min-h-screen place-items-center text-white">Loading purchase...</main>}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = searchParams.get("itemId") || "";
  const item = checkoutItems[itemId];

  return (
    <main className="cm-page grid min-h-screen place-items-center p-6 text-white">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="cm-panel w-full max-w-lg p-8 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] border border-[#b8ff38]/35 bg-[#b8ff38]/12 text-5xl text-[#b8ff38]">✓</div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#d4af37]">Payment Successful</p>
        <h1 className="mt-2 text-4xl font-black">Purchase complete</h1>
        <p className="mt-3 text-white/58">
          You have successfully purchased <span className="font-black text-[#f7d96b]">{item?.name || "your item"}</span>.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button onClick={() => router.push("/profile")} className="cm-button px-5 py-3 font-black">
            View Inventory
          </button>
          <button onClick={() => router.push("/shop")} className="rounded-md border border-white/10 px-5 py-3 font-black text-white/72 hover:text-white">
            Back to Shop
          </button>
        </div>
      </div>
    </main>
  );
}
