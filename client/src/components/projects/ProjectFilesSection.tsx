import { useState, useEffect } from 'react';
import axios from 'axios';
import { pugProjectsApi, PugProjectAttachment } from '../../services/api';
import { safeLocalStorage } from '../../utils/storage';
import { useTranslation } from '../../i18n/I18nContext';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { FileText, Trash2, Upload, MapPin, Camera } from 'lucide-react';
import { timeAgo } from '../../utils/helpers';

// Try to grab the user's location once before upload. Returns null on
// permission denial, browser unsupport, or timeout (so a non-mobile
// upload doesn't hang). The 6-second timeout means a stuck GPS resolves
// to "no location" rather than blocking the upload entirely.
async function tryCaptureLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 6000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timer);
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
            },
            () => { clearTimeout(timer); resolve(null); },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 }
        );
    });
}

interface Props {
    projectId: string;
}

// Project-scoped Files panel — sits on ProjectDetailPage. Architecture / GPR
// firms keep deliverables (plans, permits, site photos, contracts) here
// instead of on a single task.
export default function ProjectFilesSection({ projectId }: Props) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [files, setFiles] = useState<PugProjectAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    async function reload() {
        try {
            const data = await pugProjectsApi.listAttachments(projectId);
            setFiles(data);
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { reload(); }, [projectId]);

    async function onUpload(e: React.ChangeEvent<HTMLInputElement>, capturePhoto = false) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            // Geolocation: only request it for photos (image MIME), and only
            // when the user explicitly used the "Capture photo" path on
            // mobile. For desktop file uploads we skip — most office files
            // (PDFs, contracts) don't need a location and the permission
            // prompt would be jarring.
            const wantsGeo = capturePhoto && file.type.startsWith('image/');
            const geo = wantsGeo ? await tryCaptureLocation() : null;

            const fd = new FormData();
            fd.append('file', file);
            if (geo) {
                fd.append('geo_lat', String(geo.lat));
                fd.append('geo_lng', String(geo.lng));
                fd.append('geo_accuracy', String(geo.accuracy));
                fd.append('captured_at', new Date().toISOString());
            }
            const token = safeLocalStorage.get('visoro_token');
            const activeCompany = safeLocalStorage.get('visoro_active_company_id');
            const res = await axios.post(`/api/upload/project/${projectId}`, fd, {
                headers: {
                    Authorization: token ? `Bearer ${token}` : '',
                    'X-Active-Company': activeCompany || '',
                },
            });
            setFiles(prev => [res.data, ...prev]);
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function onDelete(id: string) {
        try {
            await pugProjectsApi.deleteAttachment(projectId, id);
            setFiles(prev => prev.filter(f => f.id !== id));
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    const canDelete = (a: PugProjectAttachment) =>
        a.uploaded_by === user?.id || user?.role === 'admin' || user?.role === 'superadmin';

    return (
        <div className="mt-6 p-4 bg-navy-900/30 border border-navy-700/40 rounded-xl">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-navy-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-navy-400" />
                    {t('projects.files_section_title')}
                    <span className="text-xs text-navy-500 font-normal">({files.length})</span>
                </h3>
                <div className="flex items-center gap-3">
                    {/* Mobile-only "Take photo" path: capture attribute opens
                        the device camera directly, and we ask for geolocation
                        right after for a geotagged sample. Hidden on desktop
                        via the md:hidden class — desktop users get the
                        regular Upload button. */}
                    <label className="md:hidden flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                        <Camera className="w-3 h-3" />
                        {t('projects.capture_photo')}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => onUpload(e, true)}
                            disabled={uploading}
                        />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                        {uploading ? (
                            <span className="text-navy-400">{t('common.loading')}</span>
                        ) : (
                            <>
                                <Upload className="w-3 h-3" />
                                {t('attachments.upload_button')}
                            </>
                        )}
                        <input type="file" className="hidden" onChange={e => onUpload(e, false)} disabled={uploading} />
                    </label>
                </div>
            </div>

            {loading ? (
                <p className="text-xs text-navy-500 py-2">{t('common.loading')}</p>
            ) : files.length === 0 ? (
                <p className="text-xs text-navy-500 py-4 text-center">{t('projects.files_empty')}</p>
            ) : (
                <div className="space-y-1">
                    {files.map(f => {
                        const hasGeo = f.geo_lat != null && f.geo_lng != null;
                        return (
                            <div key={f.id} className="flex items-center gap-2 group bg-navy-800/40 rounded-lg px-3 py-2">
                                <FileText className="w-4 h-4 text-navy-400 flex-shrink-0" />
                                <a
                                    href={f.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-sm text-blue-300 hover:text-blue-200 truncate"
                                >
                                    {f.file_name}
                                </a>
                                {hasGeo && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${f.geo_lat},${f.geo_lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-400 hover:text-emerald-300 flex-shrink-0"
                                        title={`${f.geo_lat?.toFixed?.(5) ?? ''}, ${f.geo_lng?.toFixed?.(5) ?? ''} (±${Math.round(f.geo_accuracy ?? 0)} m)`}
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                    </a>
                                )}
                                <span className="text-[11px] text-navy-500 hidden md:inline">
                                    {(f.file_size / 1024).toFixed(0)} KB
                                </span>
                                <span className="text-[11px] text-navy-500 hidden md:inline truncate max-w-[140px]">
                                    {f.uploaded_by_name}
                                </span>
                                <span className="text-[11px] text-navy-500">{timeAgo(f.created_at)}</span>
                                {canDelete(f) && (
                                    <button
                                        onClick={() => onDelete(f.id)}
                                        className="text-navy-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={t('common.delete')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
