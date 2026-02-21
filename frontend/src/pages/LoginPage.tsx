import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";

type LoginForm = {
    usernameOrEmail: string;
    password: string;
};

export function LoginPage() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({
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
            <p className="text-muted">
                Access your RecruitAI workspace to pick up where you left off.
            </p>
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
                    {errors.usernameOrEmail && (
                        <span className="error">{errors.usernameOrEmail.message}</span>
                    )}
                </label>

                <label>
                    Password
                    <input
                        type="password"
                        {...register("password", { required: "Password is required" })}
                        placeholder="Your password"
                        autoComplete="current-password"
                    />
                    {errors.password && (
                        <span className="error">{errors.password.message}</span>
                    )}
                </label>

                {serverError && (
                    <div className="error" role="alert">
                        {serverError}
                    </div>
                )}

                <button className="btn" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in..." : "Login"}
                </button>
            </form>
            <p className="subcopy">
                New here?{" "}
                <Link to="/signup">
                    Create an account
                </Link>
            </p>
        </main>
    );
}
