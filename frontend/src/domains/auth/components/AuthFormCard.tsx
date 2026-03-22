"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { authApi } from "@/domains/auth/api";
import { useAuthStore } from "@/domains/auth/model";
import { ApiError } from "@/lib/api/client";

type Mode = "login" | "register";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/25 focus:bg-white/[0.05] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]";

export function AuthFormCard({ mode }: { mode: Mode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (isRegister && password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const session = isRegister
        ? await authApi.register({
            email,
            password,
            full_name: fullName.trim() || undefined,
          })
        : await authApi.login({ email, password });

      setSession(session);
      setSuccess(isRegister ? t("registerSuccess") : t("loginSuccess"));
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem.detail ?? err.problem.title);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("genericError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {isRegister ? (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="fullName">
            {t("fullName")}
          </label>
          <input
            id="fullName"
            className={inputClassName}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t("fullNamePlaceholder")}
            autoComplete="name"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="email">
          {t("email")}
        </label>
        <input
          id="email"
          className={inputClassName}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="password">
          {t("password")}
        </label>
        <input
          id="password"
          className={inputClassName}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("passwordPlaceholder")}
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={8}
        />
      </div>

      {isRegister ? (
        <div className="space-y-2">
          <label
            className="text-xs uppercase tracking-[0.24em] text-white/45"
            htmlFor="confirmPassword"
          >
            {t("confirmPassword")}
          </label>
          <input
            id="confirmPassword"
            className={inputClassName}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={t("confirmPasswordPlaceholder")}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
      ) : null}

      {mode === "login" ? (
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs uppercase tracking-[0.22em] text-white/40 transition hover:text-white/75"
          >
            {t("forgotPassword")}
          </Link>
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-2xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-2xl border border-emerald-400/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button disabled={isSubmitting} type="submit" size="lg">
          {isSubmitting
            ? isRegister
              ? t("registerLoading")
              : t("loginLoading")
            : isRegister
              ? t("registerSubmit")
              : t("loginSubmit")}
        </Button>

        <p className="text-sm text-white/45">
          {isRegister ? t("haveAccount") : t("needAccount")}{" "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="text-white/80 underline decoration-white/20 underline-offset-4 transition hover:text-white"
          >
            {isRegister ? t("navLogin") : t("navRegister")}
          </Link>
        </p>
      </div>
    </form>
  );
}
