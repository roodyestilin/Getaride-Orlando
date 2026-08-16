import Link from "next/link";
import SiteHeader from "@/src/components/SiteHeader";
import {
  MapPin, Tags, CarFront, DollarSign, Plane, ShieldCheck, Star,
} from "lucide-react";
import { Button } from "@/src/components/ui";

const STEPS = [
  { icon: MapPin, title: "Set your route", desc: "Every trip starts or ends at Orlando International (MCO). Add your pickup and drop-off." },
  { icon: Tags, title: "Compare offers", desc: "Nearby drivers send you fares. You see the price, ETA, car and rating up front." },
  { icon: CarFront, title: "Pick & ride", desc: "Choose the driver that works for you, track them live, and pay securely in-app." },
];

const FEATURES = [
  { icon: DollarSign, title: "You choose the price", desc: "Unlike other apps, drivers bid on your trip. Compare and pick the offer that fits your budget." },
  { icon: Plane, title: "Airport specialists", desc: "Built for MCO transfers — flight, terminal and baggage details baked right into every booking." },
  { icon: ShieldCheck, title: "Transparent & secure", desc: "No surprise surge. Your card is only charged when you accept an offer." },
  { icon: Star, title: "Vetted drivers", desc: "Every driver is reviewed and approved before they can accept a single ride." },
];

const PREVIEW = [
  { name: "Marcus B.", car: "White Tesla Model 3", rating: "4.9", eta: "4 min", fare: "38.00" },
  { name: "Aisha R.", car: "Silver Toyota Camry", rating: "4.8", eta: "6 min", fare: "34.50" },
  { name: "Liam W.", car: "Gray Ford Escape", rating: "4.6", eta: "3 min", fare: "41.00" },
];

export default function Home() {
  return (
    <div>
      <SiteHeader />

      {/* Hero */}
      <section className="bg-brand-tertiary">
        <div className="mx-auto max-w-container px-6 py-16 lg:py-24">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <div className="flex-1 basis-[480px] space-y-5">
              <p className="text-[13px] font-bold tracking-widest text-brand-primary">ORLANDO · MCO AIRPORT TRANSFERS</p>
              <h1 className="text-5xl font-bold leading-tight text-ink lg:text-[52px]">Your airport ride, your price.</h1>
              <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
                Getaride is Orlando&apos;s ride marketplace. Drivers send you offers — you compare fares, ETAs and ratings, then pick the one you like. No surge, no guessing.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/rider"><Button size="lg">Get a ride</Button></Link>
                <Link href="/drive"><Button size="lg" variant="light">Become a driver</Button></Link>
              </div>
            </div>

            {/* Booking preview card */}
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
              <h3 className="mb-3 text-lg font-bold">Compare driver offers</h3>
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-surface-alt px-3 py-3">
                <Plane className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-semibold">Orlando Intl (MCO)</span>
              </div>
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-alt px-3 py-3">
                <MapPin className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-semibold">Disney Springs, Orlando</span>
              </div>
              {PREVIEW.map((o) => (
                <div key={o.name} className="mb-2 flex items-center gap-3 rounded-xl border border-line p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tertiary text-sm font-bold text-brand-onTertiary">
                    {o.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{o.name}</p>
                    <p className="text-xs text-ink-muted">★ {o.rating} · {o.eta} · {o.car}</p>
                  </div>
                  <span className="font-mono text-lg font-bold">${o.fare}</span>
                </div>
              ))}
              <p className="mt-2 text-center text-xs text-ink-muted">Preview — start a real booking anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-container px-6">
          <h2 className="mb-12 text-center text-3xl font-bold lg:text-4xl">How Getaride works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-xl border border-line bg-white p-6">
                <span className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary font-mono text-sm font-bold text-white">{i + 1}</span>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tertiary">
                  <s.icon className="h-6 w-6 text-brand-primary" />
                </div>
                <h3 className="mb-1 text-lg font-bold">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why riders */}
      <section className="bg-surface-alt py-20">
        <div className="mx-auto max-w-container px-6">
          <h2 className="mb-12 text-center text-3xl font-bold lg:text-4xl">Why riders choose Getaride</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl bg-white p-6 shadow-card">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tertiary">
                  <f.icon className="h-6 w-6 text-brand-primary" />
                </div>
                <h3 className="mb-1 text-lg font-bold">{f.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Drive band */}
      <section className="bg-brand-primary py-14">
        <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-6 px-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white">Shift into earnings mode</h2>
            <p className="mt-2 max-w-2xl text-white/90">Set your own fares, drive Orlando&apos;s steady airport demand, and keep 100% of every tip. Apply in minutes.</p>
          </div>
          <Link href="/drive"><Button size="lg" variant="light">Apply to drive</Button></Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-container px-6">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-alt px-6 py-16 text-center">
            <h2 className="text-3xl font-bold lg:text-4xl">Ready when you are</h2>
            <p className="max-w-xl text-lg text-ink-soft">Book your next Orlando airport ride and let drivers compete for your fare.</p>
            <Link href="/rider" className="mt-2"><Button size="lg">Get a ride</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-container px-6 text-center text-sm text-ink-muted">
          © {new Date().getFullYear()} Getaride Orlando. All rides start or end at MCO.
        </div>
      </footer>
    </div>
  );
}
