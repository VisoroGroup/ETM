import { useRef } from 'react';
import { attachmentsApi } from '../../../services/api';
import type { TaskDetail } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { timeAgo, formatFileSize } from '../../../utils/helpers';
import { Paperclip, Upload, Download, Trash2 } from 'lucide-react';

interface Props {
    task: TaskDetail;
    taskId: string;
    onReload: () => void;
    onUpdate: () => void;
}

export default function FilesTab({ task, taskId, onReload, onUpdate }: Props) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await attachmentsApi.upload(taskId, file);
            showToast('Fișier încărcat!');
            onReload();
            onUpdate();
        } catch {
            showToast('Eroare la încărcare', 'error');
        }
        e.target.value = '';
    }

    async function deleteAttachment(attachmentId: string) {
        try {
            await attachmentsApi.delete(taskId, attachmentId);
            showToast('Fișier șters');
            onReload();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    return (
        <div className="space-y-3">
            <input ref={fileInputRef} type="file" onChange={uploadFile} className="hidden" />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-navy-700 rounded-lg text-sm text-navy-400 hover:border-blue-500/50 hover:text-blue-400 transition-all"
            >
                <Upload className="w-4 h-4" /> Încarcă fișier
            </button>

            {task.attachments.length > 0 ? (
                <div className="space-y-2">
                    {task.attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-3 p-3 bg-navy-800/30 rounded-lg group">
                            <Paperclip className="w-4 h-4 text-navy-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{att.file_name}</p>
                                <p className="text-xs text-navy-500">{formatFileSize(att.file_size)} · {att.uploader_name} · {timeAgo(att.created_at)}</p>
                            </div>
                            <a
                                href={att.file_url}
                                download={att.file_name}
                                className="text-navy-500 hover:text-blue-400 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                            </a>
                            {(att.uploaded_by === user?.id || user?.role === 'admin') && (
                                <button
                                    onClick={() => deleteAttachment(att.id)}
                                    className="opacity-0 group-hover:opacity-100 text-navy-500 hover:text-red-400 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Paperclip className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Niciun fișier atașat</p>
                </div>
            )}
        </div>
    );
}
