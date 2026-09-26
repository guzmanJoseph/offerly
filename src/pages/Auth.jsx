import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/auth.css";

export default function Auth() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        navigate("/dashboard", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        alert(
          "Account created! Check your email if email confirmation is required."
        );

        setIsLogin(true);
      }
    } catch (error) {
      console.error("Authentication error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      alert("Enter your email address first.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Password reset instructions have been sent to your email.");
    } catch (error) {
      console.error("Password reset error:", error);
      alert("Something went wrong. Please try again.");
    }
  }

  async function signInWithGoogle() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "openid email profile",
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("Google login error:", error);
      alert(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Link to="/" className="back-to-home">
        ← Back to Home
      </Link>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-logo">Offerly</h1>

        <h2 className="auth-title">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>

        <p className="auth-subtitle">
          Track every application. Land your next opportunity.
        </p>

        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
        />

        {isLogin && (
          <p className="auth-switch" onClick={handleForgotPassword}>
            Forgot password?
          </p>
        )}

        <button
          className="auth-button"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : isLogin
              ? "Log In"
              : "Create Account"}
        </button>

        <button
          type="button"
          className="auth-google-button"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          Continue with Google
        </button>

        <p
          className="auth-switch"
          onClick={() => setIsLogin((current) => !current)}
        >
          {isLogin
            ? "Need an account? Sign Up"
            : "Already have an account? Log In"}
        </p>
      </form>
    </div>
  );
}