import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  MapPin,
  Headphones,
  Cross,
} from "lucide-react";
import { FirebaseError } from "firebase/app";

import { useAuthContext } from "@/context/AuthContext";
import { siteConfig } from "@/config/site";

/* ─────────────────────────────────────────────────────────────────────────
   Keyframe injection (only once)
───────────────────────────────────────────────────────────────────────── */
const STYLE_ID = "login-page-animations";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes login-fade-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0);    }
    }
    @keyframes login-glow-pulse {
      0%, 100% { opacity: 0.35; }
      50%       { opacity: 0.55; }
    }
    .login-fade-up  { animation: login-fade-up 0.55s cubic-bezier(.22,.68,0,1.2) both; }
    .login-delay-1  { animation-delay: 0.08s; }
    .login-delay-2  { animation-delay: 0.16s; }
    .login-glow     { animation: login-glow-pulse 4s ease-in-out infinite; }

    /* gradient submit button */
    .login-btn {
      background: linear-gradient(135deg,
        rgb(var(--color-primary)) 0%,
        color-mix(in srgb, rgb(var(--color-primary)) 70%, #a78bfa) 100%);
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }
    .login-btn:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 22px -4px rgba(var(--color-primary) / 0.45);
      opacity: 0.93;
    }
    .login-btn:not(:disabled):active {
      transform: translateY(0);
      box-shadow: none;
    }

    /* input glow on focus */
    .login-input:focus {
      box-shadow: 0 0 0 3px rgba(var(--color-primary) / 0.18);
    }

    /* card accent top border */
    .login-card {
      position: relative;
      overflow: hidden;
    }
    .login-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 2px;
      background: linear-gradient(90deg,
        transparent 0%,
        rgb(var(--color-primary)) 40%,
        color-mix(in srgb, rgb(var(--color-primary)) 60%, #a78bfa) 60%,
        transparent 100%);
      opacity: 0.85;
    }

    /* trust badge pills */
    .login-badge {
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(var(--color-primary) / 0.07);
      border: 1px solid rgba(var(--color-primary) / 0.14);
      transition: background 0.2s ease;
    }
    .login-badge:hover {
      background: rgba(var(--color-primary) / 0.13);
    }
  `;
  document.head.appendChild(style);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login, currentUser, isLoading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && currentUser) {
      navigate("/dashboard");
    }
  }, [currentUser, isLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/invalid-email":
            setErrorMessage("Invalid email address.");
            break;
          case "auth/user-disabled":
            setErrorMessage("This account has been disabled.");
            break;
          case "auth/user-not-found":
            setErrorMessage("No account found with this email.");
            break;
          case "auth/wrong-password":
            setErrorMessage("Incorrect password.");
            break;
          case "auth/invalid-credential":
            setErrorMessage(
              "Invalid email or password. Please check your credentials and try again.",
            );
            break;
          case "auth/too-many-requests":
            setErrorMessage(
              "Too many failed login attempts. Please try again later.",
            );
            break;
          case "auth/network-request-failed":
            setErrorMessage(
              "Network error. Please check your connection and try again.",
            );
            break;
          default:
            setErrorMessage(`Failed to log in: ${error.message}`);
        }
      } else {
        setErrorMessage("An unexpected error occurred.");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[rgb(var(--color-bg))] flex items-center justify-center p-4 font-sans text-[rgb(var(--color-text))] transition-colors duration-300 relative overflow-hidden">

      {/* ── Ambient glow blobs ── */}
      <div
        className="login-glow pointer-events-none absolute rounded-full"
        style={{
          width: 480,
          height: 480,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -54%)",
          background:
            "radial-gradient(ellipse at center, rgba(var(--color-primary) / 0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="w-full max-w-md relative z-10">

        {/* ── Header ── */}
        <div className="text-center mb-8 login-fade-up">
          {/* Icon badge */}
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
            style={{
              background: "rgba(var(--color-primary) / 0.12)",
              border: "1px solid rgba(var(--color-primary) / 0.25)",
            }}
          >
            <Cross className="w-5 h-5 text-[rgb(var(--color-primary))]" />
          </div>

          <h1 className="text-3xl font-bold mb-2 text-[rgb(var(--color-text))] tracking-tight">
            HSC{" "}
            <span className="text-[rgb(var(--color-primary))]">
              Laser Hospital
            </span>
          </h1>
          <p className="text-[rgb(var(--color-text-muted))] font-medium text-sm">
            Authenticate to your operational dashboard
          </p>
        </div>

        {/* ── Card ── */}
        <div className="login-card login-fade-up login-delay-1 bg-[rgb(var(--color-surface))] p-8 border border-[rgb(var(--color-border))] rounded-xl mb-6 transition-colors">
          <form className="space-y-5" onSubmit={handleLogin}>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[rgb(var(--color-text))] block">
                Official Email
              </label>
              <input
                required
                autoComplete="email"
                className="login-input w-full h-11 px-3 bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded-lg text-sm text-[rgb(var(--color-text))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:ring-1 focus:ring-[rgb(var(--color-primary))] transition-all"
                placeholder="your.name@clinic.com.np"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[rgb(var(--color-text))]">
                  Password
                </label>
                <Link
                  className="text-xs text-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary-hover))] font-medium hover:underline underline-offset-2"
                  to="/forgot-password"
                >
                  Reset password?
                </Link>
              </div>
              <div className="relative">
                <input
                  required
                  autoComplete="current-password"
                  className="login-input w-full h-11 px-3 pr-10 bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded-lg text-sm text-[rgb(var(--color-text))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:ring-1 focus:ring-[rgb(var(--color-primary))] transition-all"
                  placeholder="••••••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] transition-colors focus:outline-none"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                checked={rememberMe}
                className="w-4 h-4 rounded border-[rgb(var(--color-border))] text-[rgb(var(--color-primary))] focus:ring-[rgb(var(--color-primary))] cursor-pointer bg-[rgb(var(--color-surface))]"
                id="rememberMe"
                type="checkbox"
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label
                className="text-sm font-medium text-[rgb(var(--color-text))] cursor-pointer select-none"
                htmlFor="rememberMe"
              >
                Maintain active session
              </label>
            </div>

            {/* Error */}
            {errorMessage && (
              <div
                className={`p-4 border rounded-lg ${errorMessage.includes("subscription")
                  ? "text-[rgb(var(--color-warning))] bg-[rgb(var(--color-warning)/0.1)] border-[rgb(var(--color-warning)/0.2)]"
                  : "text-[rgb(var(--color-danger))] bg-[rgb(var(--color-danger)/0.1)] border-[rgb(var(--color-danger)/0.2)]"
                  }`}
              >
                {errorMessage.includes("subscription") && (
                  <div className="flex items-center gap-1.5 mb-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-[rgb(var(--color-warning))]" />
                    <span>Subscription Alert</span>
                  </div>
                )}
                <span className="leading-relaxed font-medium text-sm">
                  {errorMessage}
                </span>
                {errorMessage.includes("subscription") && (
                  <div className="mt-2 text-[11px] text-[rgb(var(--color-text-muted))] border-t border-[rgb(var(--color-border)/0.5)] pt-2 font-medium">
                    Please contact our central billing team immediately at{" "}
                    <a
                      className="font-bold underline hover:text-[rgb(var(--color-primary))]"
                      href="mailto:procarenepal@gmail.com"
                    >
                      procarenepal@gmail.com
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              className={`login-btn w-full mt-2 text-white font-bold h-11 rounded-lg text-sm tracking-wide focus:outline-none flex items-center justify-center ${loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Authenticating…
                </span>
              ) : (
                "Login"
              )}
            </button>


          </form>
        </div>

        {/* ── Footer ── */}
        <div className="text-center login-fade-up login-delay-2">

          <p className="text-xs text-[rgb(var(--color-text-muted))] font-medium opacity-50">
            Protected by stringent medical privacy protocols.{" "}
            <Link
              className="hover:text-[rgb(var(--color-primary))] hover:underline transition-colors"
              to="/privacy"
            >
              Privacy Standard
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

