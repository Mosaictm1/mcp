import { useQuery } from '@tanstack/react-query';
import { getExecutions } from '@/lib/api';
import { History, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function HistoryPage() {
    const { data: executions, isLoading } = useQuery({
        queryKey: ['executions'],
        queryFn: () => getExecutions(100),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'FAILED':
                return <XCircle className="w-5 h-5 text-red-400" />;
            case 'RUNNING':
                return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
            default:
                return <Clock className="w-5 h-5 text-yellow-400" />;
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Execution History</h1>
                <span className="text-dark-400">{executions?.length || 0} executions</span>
            </div>

            {executions?.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <History className="w-12 h-12 text-dark-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-dark-200 mb-2">No executions yet</h3>
                    <p className="text-dark-400">
                        Workflow executions will appear here
                    </p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-dark-700">
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Status</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Workflow</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Started</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Duration</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Tokens</th>
                            </tr>
                        </thead>
                        <tbody>
                            {executions?.map((execution: any) => (
                                <tr key={execution.id} className="border-b border-dark-700/50 hover:bg-dark-700/30">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(execution.status)}
                                            <span
                                                className={clsx(
                                                    'text-sm',
                                                    execution.status === 'SUCCESS' && 'text-green-400',
                                                    execution.status === 'FAILED' && 'text-red-400',
                                                    execution.status === 'RUNNING' && 'text-blue-400',
                                                    execution.status === 'PENDING' && 'text-yellow-400'
                                                )}
                                            >
                                                {execution.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-dark-200">
                                        {execution.workflow?.name || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-dark-400">
                                        {new Date(execution.startedAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-dark-400">
                                        {execution.durationMs ? `${(execution.durationMs / 1000).toFixed(2)}s` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-dark-400">
                                        {execution.tokensUsed}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
