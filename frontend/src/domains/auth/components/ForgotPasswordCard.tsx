"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { authApi } from "@/domains/auth/api";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/25 focus:bg-white/[0.05] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]";

export function ForgotPasswordCard() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await authApi.forgotPassword({ email });
      setSuccess(response.detail);
      setStep("reset");
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

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.resetPassword({
        email,
        code,
        new_password: newPassword,
      });
      setSuccess(response.detail);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
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
    <form className="space-y-5" onSubmit={step === "request" ? handleRequestCode : handleResetPassword}>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="forgotEmail">
          {t("email")}
        </label>
        <input
          id="forgotEmail"
          className={inputClassName}
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>

      {step === "reset" ? (
        <>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="resetCode">
              {t("resetCode")}
            </label>
            <input
              id="resetCode"
              className={inputClassName}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t("resetCodePlaceholder")}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="newPassword">
              {t("newPassword")}
            </label>
            <input
              id="newPassword"
              className={inputClassName}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t("newPasswordPlaceholder")}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="confirmNewPassword">
              {t("confirmPassword")}
            </label>
            <input
              id="confirmNewPassword"
              className={inputClassName}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/72">
          <p>{t("forgotRequestHint")}</p>
        </div>
      )}

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
            ? step === "request"
              ? t("forgotRequestLoading")
              : t("forgotResetLoading")
            : step === "request"
              ? t("forgotRequestSubmit")
              : t("forgotResetSubmit")}
        </Button>
        <div className="flex items-center gap-3 text-sm text-white/45">
          {step === "reset" ? (
            <button
              type="button"
              className="text-white/70 underline decoration-white/15 underline-offset-4 transition hover:text-white"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setStep("request");
              }}
            >
              {t("requestNewCode")}
            </button>
          ) : null}
          <Link
            href="/login"
            className="text-white/80 underline decoration-white/20 underline-offset-4 transition hover:text-white"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </form>
  );
}
