import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useAuthKit } from '@picahq/authkit';
import api from '@/lib/api';

interface Platform {
    id: string;
    name: string;
    icon: string;
}

interface Connection {
    id: string;
    platform: string;
    status: string;
}

export default function CredentialsPage() {
    const queryClient = useQueryClient();
    const [connecting, setConnecting] = useState<string | null>(null);

    // Pica AuthKit hook
    const { open } = useAuthKit({
        token: {
            url: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/pica/authkit/token`,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
            },
        },
        onSuccess: (connection) => {
            console.log('Connected:', connection);
            setConnecting(null);
            queryClient.invalidateQueries({ queryKey: ['pica-connections'] });
        },
        onError: (error) => {
            console.error('Connection error:', error);
            setConnecting(null);
        },
        onClose: () => {
            setConnecting(null);
        },
    });

    // Fetch platforms from Pica
    const { data: platformsData, isLoading: loadingPlatforms } = useQuery({
        queryKey: ['pica-platforms'],
        queryFn: async () => {
            const res = await api.get('/api/pica/platforms');
            return res.data;
        },
    });

    // Fetch user's connections
    const { data: connectionsData } = useQuery({
        queryKey: ['pica-connections'],
        queryFn: async () => {
            const res = await api.get('/api/pica/connections');
            return res.data;
        },
    });

    const platforms: Platform[] = platformsData?.platforms || [];
    const connections: Connection[] = connectionsData?.connections || [];

    const handleConnect = (platformId: string) => {
        setConnecting(platformId);
        // Open Pica AuthKit modal
        open();
    };

    const isConnected = (platformId: string) => {
        return connections.some(c => c.platform === platformId);
    };

    if (loadingPlatforms) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold gradient-text">Connections</h1>
                    <p className="text-dark-400 mt-1">
                        Connect your accounts to enable automations
                    </p>
                </div>
            </div>

            {/* Platforms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {platforms.map((platform) => {
                    const connected = isConnected(platform.id);
                    const isConnecting = connecting === platform.id;

                    return (
                        <div
                            key={platform.id}
                            className={`glass-card p-5 transition-all ${connected
                                    ? 'border-green-500/30 bg-green-500/5'
                                    : 'hover:border-primary-500/30'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{platform.icon}</span>
                                    <div>
                                        <h3 className="font-medium text-dark-100">
                                            {platform.name}
                                        </h3>
                                        {connected && (
                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleConnect(platform.id)}
                                    disabled={isConnecting}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${connected
                                            ? 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                            : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                                        }`}
                                >
                                    {isConnecting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : connected ? (
                                        <>
                                            <ExternalLink className="w-4 h-4" />
                                            Reconnect
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Connect
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info Section */}
            <div className="glass-card p-4 bg-primary-500/5 border-primary-500/20">
                <div className="flex items-start gap-3">
                    <Key className="w-5 h-5 text-primary-400 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-dark-100">Secure Connections</h4>
                        <p className="text-sm text-dark-400 mt-1">
                            Your credentials are securely managed by Pica. We never store your passwords - only secure OAuth tokens.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
