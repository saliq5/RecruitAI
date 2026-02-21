import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function MePage() {
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
            <p className="text-muted">
                Account details for your RecruitAI profile.
            </p>
            <ul className="card">
                <li>
                    <strong>ID:</strong> {user.id}
                </li>
                <li>
                    <strong>Username:</strong> {user.username}
                </li>
                <li>
                    <strong>Email:</strong> {user.email}
                </li>
                <li>
                    <strong>Role:</strong> {user.role}
                </li>
            </ul>
            <div className="button-row">
                <Link className="btn secondary" to="/">
                    Back to Landing
                </Link>
                <button className="btn danger" onClick={logout}>
                    Logout
                </button>
            </div>
        </main>
    );
}
