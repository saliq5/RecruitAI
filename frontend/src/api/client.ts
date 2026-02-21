import axios from "axios";
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig, AxiosRequestConfig } from "axios";

const API_BASE =
    import.meta.env.VITE_API_BASE?.toString() ?? "http://localhost:8080/api";

export interface LoginRequest {
    usernameOrEmail: string;
    password: string;
}
export interface SignupRequest {
    username: string;
    email: string;
    password: string;
}
export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}
export interface MeResponse {
    id: string;
    username: string;
    email: string;
    role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export const storage = {
    get accessToken() {
        return localStorage.getItem("accessToken") ?? "";
    },
    set accessToken(token: string) {
        localStorage.setItem("accessToken", token);
    },
    get refreshToken() {
        return localStorage.getItem("refreshToken") ?? "";
    },
    set refreshToken(token: string) {
        localStorage.setItem("refreshToken", token);
    },
    clear() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
    },
};

export const api = axios.create({
    baseURL: API_BASE,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = storage.accessToken;
    if (token) {
        if (!config.headers) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (config as any).headers = {};
        }
        // Support AxiosHeaders or plain object
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const h: any = config.headers;
            if (h.set) {
                h.set("Authorization", `Bearer ${token}`);
            } else {
                h["Authorization"] = `Bearer ${token}`;
            }
        } catch {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (config.headers as any)["Authorization"] = `Bearer ${token}`;
        }
    }
    return config;
});

let isRefreshing = false;
let pendingQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
    pendingQueue.forEach((p) => {
        if (error) {
            p.reject(error);
        } else {
            p.resolve(token ?? undefined);
        }
    });
    pendingQueue = [];
};

api.interceptors.response.use(
    (resp: AxiosResponse) => resp,
    async (error: AxiosError) => {
        const original = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
        const status = error?.response?.status;

        if (status === 401 && original && !original._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingQueue.push({ resolve, reject });
                })
                    .then(() => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ((original.headers as any) ??= {});
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (original.headers as any)["Authorization"] = `Bearer ${storage.accessToken}`;
                        return api.request(original as unknown as AxiosRequestConfig);
                    })
                    .catch((err) => Promise.reject(err));
            }

            original._retry = true;
            isRefreshing = true;

            try {
                const rt = storage.refreshToken;
                if (!rt) throw new Error("No refresh token");
                const refreshResp = await axios.post<AuthResponse>(
                    `${API_BASE}/auth/refresh`,
                    { refreshToken: rt }
                );
                storage.accessToken = refreshResp.data.accessToken;
                storage.refreshToken = refreshResp.data.refreshToken;
                processQueue(null, refreshResp.data.accessToken);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((original.headers as any) ??= {});
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (original.headers as any)["Authorization"] = `Bearer ${storage.accessToken}`;
                return api.request(original as unknown as AxiosRequestConfig);
            } catch (e) {
                processQueue(e, null);
                storage.clear();
                return Promise.reject(e);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// API helpers
export async function login(req: LoginRequest): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", req);
    return data;
}

export async function signup(req: SignupRequest): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/signup", req);
    return data;
}

export async function me(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>("/users/me");
    return data;
}
