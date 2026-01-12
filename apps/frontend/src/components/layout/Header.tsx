import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';

export default function Header() {
    const { user, signOut } = useAuth();

    return (
        <header className="h-16 px-6 flex items-center justify-between border-b border-dark-700/30">
            <div>
                <h2 className="text-lg font-medium text-dark-100">
                    Welcome back
                </h2>
                <p className="text-sm text-dark-400">
                    What would you like to automate today?
                </p>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-4 py-2 glass-card">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-dark-200">
                        {user?.email?.split('@')[0]}
                    </span>
                </div>

                <button
                    onClick={() => signOut()}
                    className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700/50 transition-colors"
                    title="Sign out"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}
