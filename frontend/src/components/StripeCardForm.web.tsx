import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { colors } from "@/src/theme";

const pk = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as string;
const stripePromise = pk ? loadStripe(pk) : null;

type Props = {
  clientSecret: string;
  onSaved: (setupIntentId: string) => void;
  onError: (msg: string) => void;
};

function InnerForm({ onSaved, onError }: Omit<Props, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const submit = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    setBusy(false);
    if (error) {
      onError(error.message || "Your card could not be saved.");
      return;
    }
    if (setupIntent && setupIntent.status === "succeeded") onSaved(setupIntent.id);
    else onError("Card setup was not completed. Please try again.");
  };

  return (
    <div style={{ width: "100%" }}>
      <PaymentElement onReady={() => setReady(true)} />
      <button
        onClick={submit}
        disabled={!stripe || !ready || busy}
        style={{
          marginTop: 20,
          width: "100%",
          height: 52,
          borderRadius: 14,
          border: "none",
          cursor: busy ? "default" : "pointer",
          background: colors.brandPrimary,
          color: "#fff",
          fontSize: 16,
          fontWeight: 700,
          opacity: !stripe || !ready || busy ? 0.6 : 1,
        }}
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </div>
  );
}

export default function StripeCardForm({ clientSecret, onSaved, onError }: Props) {
  if (!stripePromise) {
    return null;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: colors.brandPrimary } } }}>
      <InnerForm onSaved={onSaved} onError={onError} />
    </Elements>
  );
}
