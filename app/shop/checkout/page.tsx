"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import { checkoutItems } from "@/app/lib/shop-catalog";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="cm-page grid min-h-screen place-items-center text-white">Loading checkout...</main>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = searchParams.get("itemId") || "";
  const item = checkoutItems[itemId];
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvc: "",
    cardholderName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!item) {
    return (
      <main className="cm-page grid min-h-screen place-items-center p-6 text-white">
        <div className="cm-panel max-w-md p-6 text-center">
          <p className="text-2xl font-black">Item not found</p>
          <button onClick={() => router.push("/shop")} className="cm-button mt-5 px-6 py-3 font-black">
            Back to Shop
          </button>
        </div>
      </main>
    );
  }

  function handleInputChange(field: keyof typeof cardData, value: string) {
    let nextValue = value;

    if (field === "cardNumber") {
      nextValue = value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
    }

    if (field === "expiryDate") {
      const digits = value.replace(/\D/g, "").slice(0, 4);
      nextValue = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    }

    if (field === "cvc") {
      nextValue = value.replace(/\D/g, "").slice(0, 3);
    }

    setCardData((current) => ({ ...current, [field]: nextValue }));
  }

  async function handlePayment() {
    setLoading(true);
    setError("");

    const digits = cardData.cardNumber.replace(/\s/g, "");
    if (digits.length !== 16 || cardData.expiryDate.length !== 5 || cardData.cvc.length !== 3 || !cardData.cardholderName.trim()) {
      setError("Please fill in all fields correctly.");
      setLoading(false);
      return;
    }

    window.setTimeout(() => {
      router.push(`/shop/success?itemId=${encodeURIComponent(item.id)}`);
    }, 650);
  }

  return (
    <main className="cm-page min-h-screen p-4 text-white">
      <div className="mx-auto max-w-md py-8">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => router.push("/shop")} className="text-sm font-bold text-white/55 hover:text-white">
            Back to Shop
          </button>
          <ThemeToggle />
        </div>

        <div className="chaos-store-card overflow-hidden">
          <div className="chaos-store-visual bg-[radial-gradient(circle_at_center,rgba(184,255,56,0.22),transparent_28%),linear-gradient(135deg,#111827,#030712)]">
            <span className="text-6xl font-black text-white">{item.image}</span>
          </div>
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#d4af37]">Order Summary</p>
            <h1 className="mt-2 text-3xl font-black text-white">{item.name}</h1>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/42">Total</p>
              <p className="mt-1 text-4xl font-black text-[#b8ff38]">{item.price}</p>
            </div>
          </div>
        </div>

        <div className="cm-panel mt-5 p-6">
          <h2 className="text-lg font-black">Payment Information</h2>
          {error && <div className="mt-4 rounded-md border border-red-400/35 bg-red-500/15 p-3 text-sm text-red-100">{error}</div>}

          <div className="mt-4 space-y-4">
            <CheckoutInput label="Cardholder Name" value={cardData.cardholderName} placeholder="John Doe" onChange={(value) => handleInputChange("cardholderName", value)} />
            <CheckoutInput label="Card Number" value={cardData.cardNumber} placeholder="1234 5678 9012 3456" maxLength={19} mono onChange={(value) => handleInputChange("cardNumber", value)} />
            <div className="grid grid-cols-2 gap-4">
              <CheckoutInput label="MM/YY" value={cardData.expiryDate} placeholder="12/25" maxLength={5} mono onChange={(value) => handleInputChange("expiryDate", value)} />
              <CheckoutInput label="CVC" value={cardData.cvc} placeholder="123" maxLength={3} mono onChange={(value) => handleInputChange("cvc", value)} />
            </div>
          </div>

          <button onClick={handlePayment} disabled={loading} className="mt-6 w-full rounded-xl bg-[#b8ff38] px-4 py-3 text-lg font-black text-black disabled:opacity-45">
            {loading ? "Processing..." : `Pay ${item.price}`}
          </button>
          <p className="mt-4 text-center text-xs text-white/42">Demo checkout. No real payment will be processed.</p>
        </div>
      </div>
    </main>
  );
}

function CheckoutInput({
  label,
  value,
  placeholder,
  maxLength,
  mono = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength?: number;
  mono?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white/55">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-md border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[#d4af37] ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}
