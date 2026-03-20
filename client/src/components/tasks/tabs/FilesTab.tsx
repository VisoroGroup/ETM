import { useState, useRef } from 'react';
import { attachmentsApi } from '../../../services/api';
import type { TaskDetail, TaskAttachment } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { timeAgo, formatFileSize } from '../../../utils/helpers';
import {
    Paperclip, Upload, Download, Trash2, X, ChevronLeft, ChevronRight,
    FileText, File, Image as ImageIcon
} from 'lucide-react';

interface Props {
    task: TaskDetail;
    taskId: string;
    onReload: () => void;
    onUpdate: () => void;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const PDF_EXTS = ['pdf'];

function getExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

function isImage(filename: string) {
    return IMAGE_EXTS.includes(getExtension(filename));
}

function isPdf(filename: string) {
    return PDF_EXTS.includes(getExtension(filename));
}

export default function FilesTab({ task, taskId, onReload, onUpdate }: Props) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [pdfPreview, setPdfPreview] = useState<string | null>(null);

    // Separate images from other files
    const images = task.attachments.filter(a => isImage(a.file_name));
    const otherFiles = task.attachments.filter(a => !isImage(a.file_name));

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

    function openLightbox(imgIndex: number) {
        setLightboxIndex(imgIndex);
    }

    function navigateLightbox(dir: -1 | 1) {
        if (lightboxIndex === null) return;
        const next = lightboxIndex + dir;
        if (next >= 0 && next < images.length) setLightboxIndex(next);
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

            {task.attachments.length === 0 ? (
                <div className="text-center py-8">
                    <Paperclip className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Niciun fișier atașat</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Images grid */}
                    {images.length > 0 && (
                        <div>
                            <p className="text-xs text-navy-400 mb-2 flex items-center gap-1.5">
                                <ImageIcon className="w-3 h-3" /> Imagini ({images.length})
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {images.map((att, idx) => (
                                    <div key={att.id} className="group relative aspect-square rounded-lg overflow-hidden bg-navy-800 border border-navy-700/50 cursor-pointer hover:border-blue-500/50 transition-colors"
                                        onClick={() => openLightbox(idx)}
                                    >
                                        <img
                                            src={att.file_url}
                                            alt={att.file_name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                                            <p className="text-[9px] text-white opacity-0 group-hover:opacity-100 p-1.5 truncate w-full bg-gradient-to-t from-black/60 to-transparent transition-opacity">
                                                {att.file_name}
                                            </p>
                                        </div>
                                        {/* Delete button */}
                                        {(att.uploaded_by === user?.id || user?.role === 'admin') && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                                                className="absolute top-1 right-1 p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100 text-white hover:text-red-400 transition-all"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other files list */}
                    {otherFiles.length > 0 && (
                        <div>
                            {images.length > 0 && (
                                <p className="text-xs text-navy-400 mb-2 flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> Documente ({otherFiles.length})
                                </p>
                            )}
                            <div className="space-y-2">
                                {otherFiles.map(att => (
                                    <div key={att.id} className="flex items-center gap-3 p-3 bg-navy-800/30 rounded-lg group">
                                        {isPdf(att.file_name) ? (
                                            <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        ) : (
                                            <File className="w-4 h-4 text-navy-500 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{att.file_name}</p>
                                            <p className="text-xs text-navy-500">{formatFileSize(att.file_size)} · {att.uploader_name} · {timeAgo(att.created_at)}</p>
                                        </div>
                                        {isPdf(att.file_name) && (
                                            <button
                                                onClick={() => setPdfPreview(pdfPreview === att.file_url ? null : att.file_url)}
                                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                {pdfPreview === att.file_url ? 'Ascunde' : 'Previzualizare'}
                                            </button>
                                        )}
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
                        </div>
                    )}

                    {/* PDF inline preview */}
                    {pdfPreview && (
                        <div className="rounded-lg overflow-hidden border border-navy-700/50">
                            <iframe
                                src={pdfPreview}
                                className="w-full h-96 bg-white"
                                title="PDF previzualizare"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Image Lightbox */}
            {lightboxIndex !== null && images[lightboxIndex] && (
                <div
                    className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center animate-fade-in"
                    onClick={() => setLightboxIndex(null)}
                >
                    {/* Close */}
                    <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10">
                        <X className="w-6 h-6" />
                    </button>

                    {/* Left arrow */}
                    {lightboxIndex > 0 && (
                        <button
                            onClick={e => { e.stopPropagation(); navigateLightbox(-1); }}
                            className="absolute left-4 p-2 text-white/70 hover:text-white bg-black/30 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}

                    {/* Image */}
                    <img
                        src={images[lightboxIndex].file_url}
                        alt={images[lightboxIndex].file_name}
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />

                    {/* Right arrow */}
                    {lightboxIndex < images.length - 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); navigateLightbox(1); }}
                            className="absolute right-4 p-2 text-white/70 hover:text-white bg-black/30 rounded-full transition-colors"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}

                    {/* Caption + download */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur rounded-lg px-4 py-2">
                        <span className="text-sm text-white">{images[lightboxIndex].file_name}</span>
                        <span className="text-xs text-white/50">{lightboxIndex + 1}/{images.length}</span>
                        <a
                            href={images[lightboxIndex].file_url}
                            download={images[lightboxIndex].file_name}
                            onClick={e => e.stopPropagation()}
                            className="text-blue-400 hover:text-blue-300"
                        >
                            <Download className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
