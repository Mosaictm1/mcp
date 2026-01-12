import { NavLink } from 'react-router-dom';
import {
    MessageSquare,
    History,
    Key,
    Settings,
    Zap
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
    { to: '/', icon: MessageSquare, label: 'Chat' },
    { to: '/history', icon: History, label: 'History' },
    { to: '/credentials', icon: Key, label: 'Credentials' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
    return (
        <aside className="w-64 glass-card m-3 mr-0 flex flex-col">
            {/* Logo */}
            <div className="p-4 border-b border-dark-700/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-lg gradient-text">MCP Automator</h1>
                        <p className="text-xs text-dark-400">AI-Powered Automation</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                                isActive
                                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                                    : 'text-dark-300 hover:bg-dark-700/50 hover:text-dark-100'
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-dark-700/50">
                <div className="glass-card p-3 bg-gradient-to-br from-primary-500/10 to-accent-500/10">
                    <p className="text-xs text-dark-400">Free Plan</p>
                    <div className="mt-2 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                            style={{ width: '30%' }}
                        />
                    </div>
                    <p className="text-xs text-dark-400 mt-1">3,000 / 10,000 tokens</p>
                </div>
            </div>
        </aside>
    );
}
