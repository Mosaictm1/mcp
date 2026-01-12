import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, CheckCircle, Loader2, Trash2, ExternalLink, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthKit } from '@picahq/authkit';
import api from '@/lib/api';
import {
    useComposioStatus,
    useComposioConnections,
    useInitiateConnection,
    useVerifyConnection,
    useDeleteConnection,
    openComposioPopup,
    handleComposioCallback,
} from '@/lib/useComposio';

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

// Predefined auth configs from Composio Dashboard
// Add your Auth Config IDs from https://platform.composio.dev/auth-configs
const COMPOSIO_AUTH_CONFIGS = [
    { id: 'gmail', name: 'Gmail', icon: '📧', authConfigId: 'ac_9jy-YbMpWe82' },
    { id: 'slack', name: 'Slack', icon: '💬', authConfigId: '' },
    { id: 'notion', name: 'Notion', icon: '📝', authConfigId: '' },
    { id: 'google_drive', name: 'Google Drive', icon: '📁', authConfigId: '' },
    { id: 'github', name: 'GitHub', icon: '🐙', authConfigId: '' },
];

export default function CredentialsPage() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'pica' | 'composio'>('composio');
    const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // Composio hooks
    const { data: composioStatus } = useComposioStatus();
    const { data: composioConnectionsData, isLoading: _loadingComposio, refetch: refetchComposio } = useComposioConnections();
    const initiateConnection = useInitiateConnection();
    const verifyConnection = useVerifyConnection();
    const deleteComposioConnection = useDeleteConnection();

    // Pica AuthKit hook
    const { open } = useAuthKit({
        token: {
            url: `${API_URL}/api/authkit/token`,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
            },
        },
        onSuccess: (connection) => {
            console.log('✅ Pica Connected:', connection);
            setLoading(false);
            queryClient.invalidateQueries({ queryKey: ['pica-connections'] });
        },
        onError: (error) => {
            console.error('❌ Pica Connection error:', error);
            setLoading(false);
        },
        onClose: () => {
            setLoading(false);
        },
    });

    // Handle Composio callback on page load
    useEffect(() => {
        const callback = handleComposioCallback();
        if (callback.isCallback) {
            if (callback.success && callback.connectionId) {
                setNotification({ type: 'success', message: 'تم الاتصال بنجاح!' });
                verifyConnection.mutate({ connectionId: callback.connectionId });
            } else if (callback.error) {
                setNotification({ type: 'error', message: callback.error });
            }
        }
    }, []);

    // Fetch platforms from Pica
    const { data: platformsData, isLoading: loadingPlatforms } = useQuery({
        queryKey: ['pica-platforms'],
        queryFn: async () => {
            const res = await api.get('/api/pica/platforms');
            return res.data;
        },
        enabled: activeTab === 'pica',
    });

    // Fetch user's Pica connections
    const { data: connectionsData } = useQuery({
        queryKey: ['pica-connections'],
        queryFn: async () => {
            const res = await api.get('/api/pica/connections');
            return res.data;
        },
        enabled: activeTab === 'pica',
    });

    const platforms: Platform[] = platformsData?.platforms || [];
    const picaConnections: Connection[] = connectionsData?.connections || [];
    const composioConnections = composioConnectionsData?.connections || [];

    const handlePicaConnect = () => {
        setLoading(true);
        open();
    };

    const handleComposioConnect = async (authConfigId: string, toolkitName: string) => {
        if (!authConfigId) {
            setNotification({
                type: 'error',
                message: 'يجب إعداد Auth Config ID في لوحة تحكم Composio أولاً'
            });
            return;
        }

        setConnectingToolkit(toolkitName);
        try {
            const result = await initiateConnection.mutateAsync({
                authConfigId,
                toolkitName,
            });

            // Open popup for OAuth
            openComposioPopup(
                result.redirectUrl,
                async (connectionId) => {
                    setNotification({ type: 'success', message: 'تم الاتصال بنجاح!' });
                    await verifyConnection.mutateAsync({
                        connectionId,
                        toolkitName,
                        authConfigId
                    });
                    refetchComposio();
                    setConnectingToolkit(null);
                },
                (error) => {
                    setNotification({ type: 'error', message: error });
                    setConnectingToolkit(null);
                }
            );
        } catch (error: any) {
            setNotification({
                type: 'error',
                message: error.response?.data?.message || 'فشل بدء الاتصال'
            });
            setConnectingToolkit(null);
        }
    };

    const handleDeleteComposioConnection = async (connectionId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الاتصال؟')) return;

        try {
            await deleteComposioConnection.mutateAsync(connectionId);
            setNotification({ type: 'success', message: 'تم حذف الاتصال' });
        } catch (error: any) {
            setNotification({
                type: 'error',
                message: error.response?.data?.message || 'فشل حذف الاتصال'
            });
        }
    };

    const isPicaConnected = (platformId: string) => {
        return picaConnections.some(c => c.platform === platformId);
    };

    const isComposioConnected = (toolkitId: string) => {
        return composioConnections.some(c => c.toolkitName === toolkitId && c.status === 'ACTIVE');
    };

    // Clear notification after 5 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    return (
        <div className="space-y-6">
            {/* Notification */}
            {notification && (
                <div className={`p-4 rounded-lg ${notification.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                    {notification.message}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold gradient-text">الاتصالات</h1>
                    <p className="text-dark-400 mt-1">
                        ربط حساباتك لتفعيل الأتمتة الذكية
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 p-1 bg-dark-800/50 rounded-lg">
                    <button
                        onClick={() => setActiveTab('composio')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'composio'
                            ? 'bg-primary-500 text-white'
                            : 'text-dark-400 hover:text-white'
                            }`}
                    >
                        Composio
                        {composioStatus?.configured && (
                            <CheckCircle className="w-3 h-3 inline-block mr-1" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('pica')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'pica'
                            ? 'bg-primary-500 text-white'
                            : 'text-dark-400 hover:text-white'
                            }`}
                    >
                        Pica
                    </button>
                </div>
            </div>

            {/* Composio Tab */}
            {activeTab === 'composio' && (
                <>
                    {/* Status Banner */}
                    {!composioStatus?.configured && (
                        <div className="glass-card p-4 bg-yellow-500/5 border-yellow-500/20">
                            <div className="flex items-start gap-3">
                                <Settings className="w-5 h-5 text-yellow-400 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-dark-100">إعداد Composio</h4>
                                    <p className="text-sm text-dark-400 mt-1">
                                        أضف COMPOSIO_API_KEY في ملف .env لتفعيل التكامل
                                    </p>
                                    <a
                                        href="https://platform.composio.dev/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary-400 hover:underline flex items-center gap-1 mt-2"
                                    >
                                        فتح لوحة تحكم Composio
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Connected Services */}
                    {composioConnections.length > 0 && (
                        <div className="glass-card p-4">
                            <h3 className="text-lg font-medium text-dark-100 mb-3">الخدمات المتصلة</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {composioConnections.map((connection) => (
                                    <div
                                        key={connection.id}
                                        className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                            <div>
                                                <span className="text-dark-100">{connection.toolkitName}</span>
                                                <span className="text-xs text-dark-400 block">
                                                    {connection.status}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteComposioConnection(connection.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="حذف الاتصال"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available Integrations */}
                    <div className="glass-card p-4">
                        <h3 className="text-lg font-medium text-dark-100 mb-3">التكاملات المتاحة</h3>
                        <p className="text-sm text-dark-400 mb-4">
                            يجب إنشاء Auth Config في لوحة تحكم Composio لكل تطبيق قبل الاتصال
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {COMPOSIO_AUTH_CONFIGS.map((toolkit) => {
                                const connected = isComposioConnected(toolkit.id);
                                const isConnecting = connectingToolkit === toolkit.id;

                                return (
                                    <div
                                        key={toolkit.id}
                                        className={`glass-card p-5 transition-all ${connected
                                            ? 'border-green-500/30 bg-green-500/5'
                                            : 'hover:border-primary-500/30'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-3xl">{toolkit.icon}</span>
                                                <div>
                                                    <h3 className="font-medium text-dark-100">
                                                        {toolkit.name}
                                                    </h3>
                                                    {connected && (
                                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            متصل
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {!connected && (
                                                <button
                                                    onClick={() => handleComposioConnect(toolkit.authConfigId, toolkit.id)}
                                                    disabled={isConnecting || !composioStatus?.configured}
                                                    className="px-3 py-2 bg-primary-500/10 text-primary-400 rounded-lg hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                                                >
                                                    {isConnecting ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Plus className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Pica Tab */}
            {activeTab === 'pica' && (
                <>
                    <div className="flex justify-end">
                        <button
                            onClick={handlePicaConnect}
                            disabled={loading}
                            className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-all flex items-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Plus className="w-5 h-5" />
                            )}
                            ربط خدمة
                        </button>
                    </div>

                    {/* Connected Services */}
                    {picaConnections.length > 0 && (
                        <div className="glass-card p-4">
                            <h3 className="text-lg font-medium text-dark-100 mb-3">الخدمات المتصلة</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {picaConnections.map((connection) => (
                                    <div
                                        key={connection.id}
                                        className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                                    >
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                        <span className="text-dark-100">{connection.platform}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available Platforms */}
                    {loadingPlatforms ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {platforms.map((platform) => {
                                const connected = isPicaConnected(platform.id);

                                return (
                                    <div
                                        key={platform.id}
                                        className={`glass-card p-5 transition-all ${connected
                                            ? 'border-green-500/30 bg-green-500/5'
                                            : 'hover:border-primary-500/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{platform.icon}</span>
                                            <div>
                                                <h3 className="font-medium text-dark-100">
                                                    {platform.name}
                                                </h3>
                                                {connected && (
                                                    <span className="text-xs text-green-400 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        متصل
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Info Section */}
            <div className="glass-card p-4 bg-primary-500/5 border-primary-500/20">
                <div className="flex items-start gap-3">
                    <Key className="w-5 h-5 text-primary-400 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-dark-100">اتصالات آمنة</h4>
                        <p className="text-sm text-dark-400 mt-1">
                            {activeTab === 'composio'
                                ? 'يتم إدارة بيانات الاعتماد بواسطة Composio. لا نقوم بتخزين كلمات المرور - فقط رموز OAuth الآمنة.'
                                : 'يتم إدارة بيانات الاعتماد بواسطة Pica. لا نقوم بتخزين كلمات المرور - فقط رموز OAuth الآمنة.'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
