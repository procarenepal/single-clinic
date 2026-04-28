import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  MapPin,
  Headphones,
} from "lucide-react";
import { FirebaseError } from "firebase/app";

import { useAuthContext } from "@/context/AuthContext";
import { siteConfig } from "@/config/site";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login, currentUser, isLoading } = useAuthContext();
  const navigate = useNavigate();

  // If user is already logged in, redirect to dashboard
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

      // Authentication successful - redirect will happen via the useEffect above once userData is loaded
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
    <div className="min-h-[calc(100vh-80px)] bg-[rgb(var(--color-bg))] flex items-center justify-center p-4 font-sans text-[rgb(var(--color-text))] transition-colors duration-300">
      <div className="w-full max-w-md">
        {/* Compact Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-[rgb(var(--color-text))] tracking-tight">
            Procare <span className="text-[rgb(var(--color-primary))]">Nepal</span>
          </h1>
          <p className="text-[rgb(var(--color-text-muted))] font-medium">
            Authenticate to your operational dashboard
          </p>
        </div>

        {/* Custom Login Card */}
        <div className="bg-[rgb(var(--color-surface))] p-8 border border-[rgb(var(--color-border))] rounded-lg clarity-card mb-6 transition-colors">
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[rgb(var(--color-text))] block">
                Official Email
              </label>
              <input
                required
                autoComplete="email"
                className="w-full h-11 px-3 bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded text-sm text-[rgb(var(--color-text))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:ring-1 focus:ring-[rgb(var(--color-primary))] transition-all"
                placeholder="your.name@clinic.com.np"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field */}
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
                  className="w-full h-11 px-3 pr-10 bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded text-sm text-[rgb(var(--color-text))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:ring-1 focus:ring-[rgb(var(--color-primary))] transition-all"
                  placeholder="••••••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] transition-colors focus:outline-none"
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
            <div className="flex items-center gap-2 mt-2">
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

            {/* Error Message Render */}
            {errorMessage && (
              <div
                className={`p-4 border rounded-md ${errorMessage.includes("subscription")
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

            {/* Submit Button */}
            <button
              className={`w-full mt-2 bg-[rgb(var(--color-primary))] text-white font-bold h-11 rounded text-sm tracking-wide transition-colors border-2 border-transparent focus:outline-none flex items-center justify-center ${loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
              disabled={loading}
              type="submit"
            >
              {loading ? "Authenticating..." : "Initialize Session"}
            </button>

            <div className="text-center pt-4 border-t border-[rgb(var(--color-border)/0.3)]">
              <p className="text-sm text-[rgb(var(--color-text-muted))] font-medium">
                Not utilizing Procare Software yet?{" "}
                <Link
                  className="text-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary-hover))] font-bold hover:underline underline-offset-2"
                  to="/contact"
                >
                  Contact Sales
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Minimal Footer */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-4 opacity-80">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> High Security
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Made for Nepal
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5" /> 24/7 Monitored
            </span>
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))] font-medium opacity-60">
            Protected by stringent medical privacy protocols.{" "}
            <Link
              className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:underline"
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
