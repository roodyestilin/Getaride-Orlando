"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "@/src/lib/auth";
import { Button, Input, Label } from "@/src/components/ui";
import { Logo } from "@/src/components/SiteHeader";
import { cn } from "@/src/lib/utils";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function SignupInner() {
  const { register, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<"customer" | "driver">(
    params.get("role") === "driver" ? "driver" : "customer"
  );

  const [f, setF] = useState<any>({
    name: "", email: "", password: "", phone: "", date_of_birth: "",
    vehicle_make: "", vehicle_model: "", vehicle_year: "", vehicle_color: "",
    plate: "", license_number: "", ssn: "",
  });
  const [photo, setPhoto] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(user.role === "driver" ? "/driver" : "/rider");
  }, [user, router]);

  const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e.target.value }));

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear() + 1;
    const out: number[] = [];
    for (let y = now; y >= 2010; y--) out.push(y);
    return out;
  }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(await fileToBase64(file));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!photo) { setErr("A profile photo is required."); return; }
    if (role === "driver" && !agreed) { setErr("You must accept the Driver Agreement to continue."); return; }
    setLoading(true);
    try {
      const payload: any = {
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        role,
        phone: f.phone.trim() || null,
        photo,
      };
      if (role === "customer") {
        payload.date_of_birth = f.date_of_birth;
      } else {
        Object.assign(payload, {
          vehicle_make: f.vehicle_make.trim(),
          vehicle_model: f.vehicle_model.trim(),
          vehicle_year: String(f.vehicle_year),
          vehicle_color: f.vehicle_color.trim(),
          plate: f.plate.trim(),
          license_number: f.license_number.trim(),
          ssn: f.ssn.trim(),
          agreed_terms: true,
        });
      }
      const u = await register(payload);
      router.replace(u.role === "driver" ? "/driver" : "/rider");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-brand-primary p-12 lg:flex">
        <Logo light />
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">Join Getaride Orlando.</h1>
          <p className="mt-3 max-w-md text-lg text-white/85">
            {role === "driver"
              ? "Set your own fares and earn on Orlando's steady airport demand."
              : "Let drivers compete for your fare on every MCO airport trip."}
          </p>
        </div>
        <p className="text-sm text-white/70">Orlando · MCO airport transfers</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-bold">Create your account</h2>

          {/* Role toggle */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-surface-alt p-1">
            {(["customer", "driver"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "h-10 rounded-full text-sm font-bold transition-colors",
                  role === r ? "bg-white text-brand-primary shadow-soft" : "text-ink-muted"
                )}
              >
                {r === "customer" ? "I'm a rider" : "I'm a driver"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <label className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line bg-surface-alt">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="you" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-ink-muted" />
                )}
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
              <div className="text-sm text-ink-muted">Upload a clear profile photo.<br />Required for {role === "driver" ? "driver approval" : "your account"}.</div>
            </div>

            <div><Label>Full name</Label><Input value={f.name} onChange={set("name")} placeholder="Jane Doe" required /></div>
            <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" required /></div>
            <div><Label>Password</Label><Input type="password" value={f.password} onChange={set("password")} placeholder="At least 6 characters" minLength={6} required /></div>
            <div><Label>Phone {role === "customer" && <span className="text-danger">*</span>}</Label><Input value={f.phone} onChange={set("phone")} placeholder="(407) 555-0100" required={role === "customer"} /></div>

            {role === "customer" ? (
              <div><Label>Date of birth <span className="text-danger">*</span></Label><Input type="date" value={f.date_of_birth} onChange={set("date_of_birth")} required /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Vehicle make</Label><Input value={f.vehicle_make} onChange={set("vehicle_make")} placeholder="Toyota" required /></div>
                  <div><Label>Model</Label><Input value={f.vehicle_model} onChange={set("vehicle_model")} placeholder="Camry" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Year (2010+)</Label>
                    <select value={f.vehicle_year} onChange={set("vehicle_year")} required className="h-12 w-full rounded-xl border border-line bg-white px-3 text-[15px] focus:border-brand-primary focus:outline-none">
                      <option value="">Select</option>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div><Label>Color</Label><Input value={f.vehicle_color} onChange={set("vehicle_color")} placeholder="Silver" required /></div>
                </div>
                <div><Label>License plate</Label><Input value={f.plate} onChange={set("plate")} placeholder="ABC 1234" required /></div>
                <div><Label>Driver license number</Label><Input value={f.license_number} onChange={set("license_number")} placeholder="D123-456-78-901-0" required /></div>
                <div><Label>Social Security Number</Label><Input value={f.ssn} onChange={set("ssn")} placeholder="123-45-6789" required /></div>
                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4" />
                  <span>I accept the Getaride Driver Agreement and consent to a background review of my documents.</span>
                </label>
              </>
            )}

            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
            <Button type="submit" size="lg" className="w-full" loading={loading}>Create account</Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-brand-primary">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
