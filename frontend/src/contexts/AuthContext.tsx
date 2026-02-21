import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import {
    login as apiLogin,
    signup as apiSignup,
    me as apiMe,
    storage,
    type AuthResponse,
    type MeResponse,
} from "../api/client";

export type AuthContextType = {
    user: MeResponse | null;
    accessToken: string;
    refreshToken: string;
    login: (usernameOrEmail: string, password: string) => Promise<void>;
    signup: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    fetchMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("AuthContext missing");
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
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

export function Protected({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}
