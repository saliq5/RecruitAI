import { Link } from "react-router-dom";

export function LandingPage() {
    return (
        <main className="container hero">
            <div className="hero-kicker">
                <span className="hero-kicker-dot" />
                AI-first recruiting assistant
            </div>
            <h1 className="hero-title">
                Hire smarter with <span>RecruitAI</span>
            </h1>
            <p className="hero-subtitle">
                A focused MVP to help you move from raw applications to shortlists in minutes.
                Log in or create an account to get started.
            </p>

            <div className="button-row">
                <Link className="btn" to="/login">
                    Login to dashboard
                </Link>
                <Link className="btn secondary" to="/signup">
                    Create a free account
                </Link>
            </div>

            <p className="hero-meta">
                <strong>MVP preview.</strong> No spam, no noise &mdash; just the core flows you need
                to evaluate RecruitAI.
            </p>
        </main>
    );
}
