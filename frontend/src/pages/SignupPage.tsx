import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";

type SignupForm = {
    username: string;
    email: string;
    password: string;
    confirm: string;
};

export function SignupPage() {
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<SignupForm>({
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
            <p className="text-muted">
                Create your RecruitAI account and start turning applications into shortlists.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <label>
                    Username
                    <input
                        type="text"
                        {...register("username", {
                            required: "Username is required",
                            minLength: { value: 3, message: "At least 3 characters" },
                            maxLength: { value: 32, message: "At most 32 characters" },
                            pattern: {
                                value: /^[a-zA-Z0-9._-]+$/,
                                message: "Only letters, numbers, . _ -",
                            },
                        })}
                        placeholder="your_username"
                        autoComplete="username"
                    />
                    {errors.username && (
                        <span className="error">{errors.username.message}</span>
                    )}
                </label>

                <label>
                    Email
                    <input
                        type="email"
                        {...register("email", {
                            required: "Email is required",
                            pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: "Enter a valid email",
                            },
                        })}
                        placeholder="you@example.com"
                        autoComplete="email"
                    />
                    {errors.email && (
                        <span className="error">{errors.email.message}</span>
                    )}
                </label>

                <label>
                    Password
                    <input
                        type="password"
                        {...register("password", {
                            required: "Password is required",
                            minLength: { value: 8, message: "At least 8 characters" },
                            validate: {
                                hasUpper: (v) =>
                                    /[A-Z]/.test(v) || "Must include an uppercase letter",
                                hasLower: (v) =>
                                    /[a-z]/.test(v) || "Must include a lowercase letter",
                                hasDigit: (v) =>
                                    /\d/.test(v) || "Must include a number",
                            },
                        })}
                        placeholder="Strong password"
                        autoComplete="new-password"
                    />
                    {errors.password && (
                        <span className="error">{errors.password.message}</span>
                    )}
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
                    {errors.confirm && (
                        <span className="error">{errors.confirm.message}</span>
                    )}
                </label>

                {serverError && (
                    <div className="error" role="alert">
                        {serverError}
                    </div>
                )}

                <button className="btn" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating account..." : "Sign Up"}
                </button>
            </form>
            <p className="subcopy">
                Already have an account?{" "}
                <Link to="/login">
                    Login
                </Link>
            </p>
        </main>
    );
}
