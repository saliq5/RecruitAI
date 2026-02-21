import "./App.css";
import { AuthProvider } from "./contexts/AuthContext";
import { AppRouter } from "./routes/AppRouter";

export default function App() {
  return (
    <div className="app-shell">
      <AuthProvider>
        <header>
          {/* Nav is rendered inside routes where needed */}
        </header>
        <main className="app-main">
          <div className="page-center">
            <AppRouter />
          </div>
        </main>
      </AuthProvider>
    </div>
  );
}
