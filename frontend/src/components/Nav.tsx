import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Nav() {
    const { user } = useAuth();

    return (
        <nav className="nav">
            <Link to="/" className="brand">
                RecruitAI
            </Link>
            <div className="spacer" />
            {user ? (
                <Link to="/me" className="link">
                    My Profile
                </Link>
            ) : (
                <>
                    <Link to="/login" className="link">
                        Login
                    </Link>
                    <Link to="/signup" className="link">
                        Sign Up
                    </Link>
                </>
            )}
        </nav>
    );
}
