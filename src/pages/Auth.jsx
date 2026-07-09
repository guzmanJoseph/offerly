import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/auth.css";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    const result = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    if (!isLogin) {
      alert("Check your email to confirm your account.");
    }
  }

  async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: "https://www.googleapis.com/auth/gmail.readonly",
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });

  if (error) {
    alert(error.message);
  }
}

  return (
    <div className="auth-page">
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
          onChange={e => setEmail(e.target.value)}
          required
        />

        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        <button className="auth-button" type="submit">
          {isLogin ? "Log In" : "Create Account"}
        </button>

        <button
          type="button"
          className="auth-google-button"
          onClick={signInWithGoogle}
        >
          Continue with Google
        </button>

        <p className="auth-switch" onClick={() => setIsLogin(!isLogin)}>
          {isLogin
            ? "Need an account? Sign Up"
            : "Already have an account? Log In"}
        </p>
      </form>
    </div>
  );
}