import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient, User, Session, SupabaseClient } from '@supabase/supabase-js';

// Check if Supabase is configured
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const IS_SUPABASE_CONFIGURED = SUPABASE_URL && SUPABASE_KEY &&
    SUPABASE_URL !== 'https://your-project.supabase.co';

// Create client only if configured
let supabase: SupabaseClient | null = null;
if (IS_SUPABASE_CONFIGURED) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for demo/development mode
const DEMO_USER: User = {
    id: 'demo-user-123',
    email: 'demo@n8n-autopilot.dev',
    app_metadata: {},
    user_metadata: { full_name: 'Demo User' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const isDemoMode = !IS_SUPABASE_CONFIGURED;

    useEffect(() => {
        if (!supabase) {
            // Demo mode - auto-login with mock user
            console.log('⚠️ Supabase not configured - running in demo mode');
            setUser(DEMO_USER);
            // Set a demo token for API calls
            localStorage.setItem('auth_token', 'demo-token-' + DEMO_USER.id);
            setLoading(false);
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            // Store the access token for API calls
            if (session?.access_token) {
                localStorage.setItem('auth_token', session.access_token);
            } else {
                localStorage.removeItem('auth_token');
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                // Update token in localStorage
                if (session?.access_token) {
                    localStorage.setItem('auth_token', session.access_token);
                } else {
                    localStorage.removeItem('auth_token');
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        if (!supabase) {
            setUser(DEMO_USER);
            return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string) => {
        if (!supabase) {
            setUser(DEMO_USER);
            return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };

    const signOut = async () => {
        if (!supabase) {
            setUser(null);
            return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const signInWithGoogle = async () => {
        if (!supabase) {
            setUser(DEMO_USER);
            return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) throw error;
    };

    return (
        <AuthContext.Provider
            value={{ user, session, loading, signIn, signUp, signOut, signInWithGoogle, isDemoMode }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
