import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import HistoryPage from './pages/HistoryPage';
import CredentialsPage from './pages/CredentialsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<ChatPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="credentials" element={<CredentialsPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
