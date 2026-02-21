import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Protected } from "../contexts/AuthContext";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { SignupPage } from "../pages/SignupPage";
import { MePage } from "../pages/MePage";

export function AppRouter() {
    return (
        <BrowserRouter>
            <Nav />
            <Routes>
                <Route path="/" element={<LandingPage />} />
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
    );
}
