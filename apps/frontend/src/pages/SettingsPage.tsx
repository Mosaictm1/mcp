import { useAuth } from '@/contexts/AuthContext';
import { User, Bell, Shield, CreditCard } from 'lucide-react';

export default function SettingsPage() {
    const { user } = useAuth();

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold mb-6">Settings</h1>

            {/* Profile */}
            <section className="glass-card p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <User className="w-5 h-5 text-primary-400" />
                    <h2 className="text-lg font-medium">Profile</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-dark-400 mb-1">Email</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="input-base bg-dark-800 cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-dark-400 mb-1">Name</label>
                        <input
                            type="text"
                            defaultValue={user?.user_metadata?.full_name || ''}
                            className="input-base"
                            placeholder="Your name"
                        />
                    </div>
                </div>
            </section>

            {/* Notifications */}
            <section className="glass-card p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <Bell className="w-5 h-5 text-primary-400" />
                    <h2 className="text-lg font-medium">Notifications</h2>
                </div>

                <div className="space-y-4">
                    <label className="flex items-center justify-between">
                        <span className="text-dark-200">Email notifications for failed workflows</span>
                        <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
                    </label>
                    <label className="flex items-center justify-between">
                        <span className="text-dark-200">Weekly usage summary</span>
                        <input type="checkbox" className="w-5 h-5 rounded" />
                    </label>
                </div>
            </section>

            {/* Security */}
            <section className="glass-card p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-primary-400" />
                    <h2 className="text-lg font-medium">Security</h2>
                </div>

                <button className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors">
                    Change Password
                </button>
            </section>

            {/* Billing */}
            <section className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <CreditCard className="w-5 h-5 text-primary-400" />
                    <h2 className="text-lg font-medium">Billing</h2>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg">
                    <div>
                        <p className="font-medium text-dark-100">Free Plan</p>
                        <p className="text-sm text-dark-400">10,000 tokens/month</p>
                    </div>
                    <button className="px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
                        Upgrade to Pro
                    </button>
                </div>
            </section>
        </div>
    );
}
