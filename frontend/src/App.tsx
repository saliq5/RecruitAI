import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import { login as apiLogin, signup as apiSignup, me as apiMe, storage, type AuthResponse, type MeResponse } from "./api/client";
import "./App.css";

type AuthContextType = {
  user: MeResponse | null;
  accessToken: string;
  refreshToken: string;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthContext missing");
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string>(storage.accessToken);
  const [refreshToken, setRefreshToken] = useState<string>(storage.refreshToken);

  const fetchMe = async () => {
    if (!storage.accessToken) {
      setUser(null);
      return;
    }
    try {
      const profile = await apiMe();
      setUser(profile);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    // Attempt to fetch profile on mount if we have a token
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAuth = (auth: AuthResponse) => {
    storage.accessToken = auth.accessToken;
    storage.refreshToken = auth.refreshToken;
    setAccessToken(auth.accessToken);
    setRefreshToken(auth.refreshToken);
  };

  const login = async (usernameOrEmail: string, password: string) => {
    const auth = await apiLogin({ usernameOrEmail, password });
    applyAuth(auth);
    const profile = await apiMe();
    setUser(profile);
  };

  const signup = async (username: string, email: string, password: string) => {
    const auth = await apiSignup({ username, email, password });
    applyAuth(auth);
    const profile = await apiMe();
    setUser(profile);
  };

  const logout = () => {
    storage.clear();
    setAccessToken("");
    setRefreshToken("");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, accessToken, refreshToken, login, signup, logout, fetchMe }),
    [user, accessToken, refreshToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Landing() {
  return (
    <main className="container">
      <h1>RecruitAI</h1>
      <p>Welcome to the MVP. Please login or create an account to continue.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link className="btn" to="/login">Login</Link>
        <Link className="btn secondary" to="/signup">Sign Up</Link>
      </div>
    </main>
  );
}

type LoginForm = {
  usernameOrEmail: string;
  password: string;
};

function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    mode: "onBlur",
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string>("");

  const onSubmit = async (data: LoginForm) => {
    setServerError("");
    try {
      await login(data.usernameOrEmail, data.password);
      navigate("/me");
    } catch (e: unknown) {
      const msg = isAxiosError(e)
        ? e.response?.data?.message ?? "Login failed. Check credentials."
        : "Login failed. Check credentials.";
      setServerError(msg);
    }
  };

  return (
    <main className="container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label>
          Username or Email
          <input
            type="text"
            {...register("usernameOrEmail", {
              required: "Username or email is required",
              minLength: { value: 3, message: "Must be at least 3 characters" },
            })}
            placeholder="you@example.com"
            autoComplete="username"
          />
          {errors.usernameOrEmail && <span className="error">{errors.usernameOrEmail.message}</span>}
        </label>

        <label>
          Password
          <input
            type="password"
            {...register("password", { required: "Password is required" })}
            placeholder="Your password"
            autoComplete="current-password"
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>

        {serverError && <div className="error" role="alert">{serverError}</div>}

        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>
      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </main>
  );
}

type SignupForm = {
  username: string;
  email: string;
  password: string;
  confirm: string;
};

function SignupPage() {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SignupForm>({
    mode: "onBlur",
  });
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string>("");

  const passwordValue = watch("password");

  const onSubmit = async (data: SignupForm) => {
    setServerError("");
    try {
      await signup(data.username, data.email, data.password);
      navigate("/me");
    } catch (e: unknown) {
      const msg = isAxiosError(e)
        ? e.response?.data?.message ?? "Signup failed. Try different credentials."
        : "Signup failed. Try different credentials.";
      setServerError(msg);
    }
  };

  return (
    <main className="container">
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label>
          Username
          <input
            type="text"
            {...register("username", {
              required: "Username is required",
              minLength: { value: 3, message: "At least 3 characters" },
              maxLength: { value: 32, message: "At most 32 characters" },
              pattern: { value: /^[a-zA-Z0-9._-]+$/, message: "Only letters, numbers, . _ -" },
            })}
            placeholder="your_username"
            autoComplete="username"
          />
          {errors.username && <span className="error">{errors.username.message}</span>}
        </label>

        <label>
          Email
          <input
            type="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                // Simple RFC 5322-compliant-ish pattern for MVP
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Enter a valid email",
              },
            })}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email && <span className="error">{errors.email.message}</span>}
        </label>

        <label>
          Password
          <input
            type="password"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "At least 8 characters" },
              validate: {
                hasUpper: v => /[A-Z]/.test(v) || "Must include an uppercase letter",
                hasLower: v => /[a-z]/.test(v) || "Must include a lowercase letter",
                hasDigit: v => /\d/.test(v) || "Must include a number",
              },
            })}
            placeholder="Strong password"
            autoComplete="new-password"
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            {...register("confirm", {
              required: "Please confirm your password",
              validate: (v) => v === passwordValue || "Passwords do not match",
            })}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
          {errors.confirm && <span className="error">{errors.confirm.message}</span>}
        </label>

        {serverError && <div className="error" role="alert">{serverError}</div>}

        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Sign Up"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </main>
  );
}

function MePage() {
  const { user, logout, fetchMe } = useAuth();

  useEffect(() => {
    if (!user) fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return (
      <main className="container">
        <h2>Profile</h2>
        <p>Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h2>My Profile</h2>
      <ul className="card">
        <li><strong>ID:</strong> {user.id}</li>
        <li><strong>Username:</strong> {user.username}</li>
        <li><strong>Email:</strong> {user.email}</li>
        <li><strong>Role:</strong> {user.role}</li>
      </ul>
      <div style={{ display: "flex", gap: 12 }}>
        <Link className="btn secondary" to="/">Back to Landing</Link>
        <button className="btn danger" onClick={logout}>Logout</button>
      </div>
    </main>
  );
}

function Nav() {
  const { user } = useAuth();
  return (
    <nav className="nav">
      <Link to="/" className="brand">RecruitAI</Link>
      <div className="spacer" />
      {user ? (
        <Link to="/me" className="link">My Profile</Link>
      ) : (
        <>
          <Link to="/login" className="link">Login</Link>
          <Link to="/signup" className="link">Sign Up</Link>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/me"
            element={
              <Protected>
                <MePage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
