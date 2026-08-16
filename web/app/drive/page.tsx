import Link from "next/link";
import SiteHeader from "@/src/components/SiteHeader";
import { DollarSign, Clock, Plane, ShieldCheck } from "lucide-react";
import { Button } from "@/src/components/ui";

const PERKS = [
  { icon: DollarSign, title: "Set your own fares", desc: "Bid your price on every request within a fair range. Keep 100% of tips." },
  { icon: Plane, title: "Steady airport demand", desc: "Orlando's MCO runs 24/7. Reliable trips, all day long." },
  { icon: Clock, title: "Drive on your schedule", desc: "Go online whenever you want. No shifts, no quotas." },
  { icon: ShieldCheck, title: "Fast approval", desc: "Submit your details and vehicle once. We review and get you rolling." },
];

export default function DrivePage() {
  return (
    <div>
      <SiteHeader />
      <section className="bg-ink">
        <div className="mx-auto max-w-container px-6 py-20">
          <p className="text-[13px] font-bold tracking-widest text-brand-secondary">DRIVE WITH GETARIDE</p>
          <h1 className="mt-3 max-w-2xl text-5xl font-bold leading-tight text-white">Shift into earnings mode.</h1>
          <p className="mt-4 max-w-xl text-lg text-white/80">Set your own fares, drive Orlando&apos;s steady airport demand, and keep every tip. Apply in minutes.</p>
          <Link href="/signup?role=driver" className="mt-6 inline-block"><Button size="lg">Apply to drive</Button></Link>
        </div>
      </section>
      <section className="py-20">
        <div className="mx-auto max-w-container px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {PERKS.map((p) => (
              <div key={p.title} className="rounded-xl border border-line bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tertiary">
                  <p.icon className="h-6 w-6 text-brand-primary" />
                </div>
                <h3 className="mb-1 text-lg font-bold">{p.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-muted">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
