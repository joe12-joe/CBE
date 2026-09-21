import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";

const DEMO_ACCOUNTS = [
  { email: "superadmin@cbe.go.ke", label: "Super Admin", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { email: "county@nairobi.cbe.go.ke", label: "County Admin", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { email: "subcounty@kasarani.cbe.go.ke", label: "Sub-County Admin", color: "bg-sky-100 text-sky-800 border-sky-200" },
  { email: "admin@langataestate.ac.ke", label: "School Admin", color: "bg-violet-100 text-violet-800 border-violet-200" },
  { email: "teacher@langataestate.ac.ke", label: "Teacher", color: "bg-rose-100 text-rose-800 border-rose-200" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "demo1234" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-900 p-10 text-white lg:flex print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold">CBE Manager</p>
            <p className="text-sm text-white/70">Kenya Competency-Based Education</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            One system for learners, competencies, assessments and report cards.
          </h1>
          <p className="mt-4 text-white/80">
            Manage Competency-Based Curriculum records across your school, sub-county and county —
            from Pre-Primary 1 through Junior School (Grade 9).
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs">
            {["Learner records", "CBC learning areas", "Strand assessments", "KKEC performance levels", "Report cards"].map((t) => (
              <span key={t} className="rounded-full border border-white/25 px-3 py-1 text-white/85">
                {t}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/60">
          Starter build running on demo data · Curriculum framework data to be verified against KICD.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="text-lg font-bold">CBE Manager</p>
            <p className="text-sm text-muted-foreground">Kenya Competency-Based Education</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a demo account to explore the system.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <FormField label="Email" error={errors.email?.message} required htmlFor="email">
              <Input
                id="email"
                type="email"
                placeholder="you@school.ac.ke"
                autoComplete="email"
                {...register("email")}
              />
            </FormField>
            <FormField label="Password" error={errors.password?.message} required htmlFor="password">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9"
                  autoComplete="current-password"
                  {...register("password")}
                />
              </div>
            </FormField>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <Label className="text-xs text-muted-foreground">Demo accounts (any password)</Label>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => setValue("email", a.email)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors hover:opacity-80 ${a.color}`}
                >
                  {a.label}
                  <span className="mt-0.5 block truncate font-normal opacity-80">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}