import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminApi } from "../lib/api";
import type { AdminBootstrap } from "../lib/types";
import { toast } from "../lib/toast";
import { ErrorState, IconButton } from "./ui";

export function LoginScreen({ onAuthenticated }: { onAuthenticated: (session: AdminBootstrap) => void }) {
  const { t } = useTranslation("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const login = useMutation({
    mutationFn: () => adminApi.login(email.trim(), password),
    onSuccess: (session) => {
      toast.success(t("toast.loginSucceeded"));
      setAttempted(false);
      setPassword("");
      onAuthenticated(session);
    },
  });

  return (
    <main className="login-screen">
      <section className="login-brand" aria-label={t("auth.productIdentity")}>
        <div className="login-brand-lockup">
          <img src="/assets/logo.svg" alt="" />
          <div><strong>{t("brand")}</strong><span>{t("adminConsole")}</span></div>
        </div>
        <div className="login-statement">
          <p className="eyebrow">{t("auth.statementEyebrow")}</p>
          <h1>{t("auth.title")}</h1>
          <p>{t("auth.description")}</p>
        </div>
        <div className="login-system-line">
          <ShieldCheck size={17} />
          <span>{t("auth.security")}</span>
        </div>
      </section>
      <section className="login-form-zone">
        <form
          className="login-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setAttempted(true);
            const emailValue = email.trim();
            const issues = [!emailValue ? `${t("auth.email")}：${t("validation.required")}` : "", !password ? `${t("auth.password")}：${t("validation.required")}` : ""].filter(Boolean);
            if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) issues.push(`${t("auth.email")}：${t("validation.invalidEmail")}`);
            if (issues.length) {
              toast.warning(t("toast.formInvalid"), { description: issues.join("；") });
              return;
            }
            login.mutate();
          }}
        >
          <div className="login-form-heading">
            <div className="login-lock"><LockKeyhole size={21} /></div>
            <div><p className="eyebrow">{t("auth.restricted")}</p><h2>{t("auth.loginTitle")}</h2></div>
          </div>
          <label className="field">
            <span>{t("auth.email")}</span>
             <input type="email" value={email} aria-invalid={attempted && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))} onChange={(event) => setEmail(event.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="field">
            <span>{t("auth.password")}</span>
            <div className="password-field">
              <input type={showPassword ? "text" : "password"} value={password} aria-invalid={attempted && !password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              <IconButton label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </div>
          </label>
          {login.error ? <ErrorState error={login.error} /> : null}
          <button className="button primary login-submit" type="submit" disabled={login.isPending}>
            {login.isPending ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
            {t("auth.submit")}
          </button>
          <p className="login-policy">{t("auth.policy")}</p>
        </form>
      </section>
    </main>
  );
}
