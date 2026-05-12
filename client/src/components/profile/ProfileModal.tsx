import React, { useState, useRef } from 'react';
import { X, User, Save, Camera, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { profileApi } from '../../services/api';
import UserAvatar from '../ui/UserAvatar';
import AvatarCropper from '../ui/AvatarCropper';
import { useTranslation } from '../../i18n/I18nContext';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface Props {
    onClose: () => void;
    darkMode: boolean;
}

export default function ProfileModal({ onClose, darkMode }: Props) {
    const { t } = useTranslation();
    const { user, refreshUser } = useAuth();
    // Audit-3 H21/H24: Esc closes, focus restored on close.
    useModalDismiss(true, onClose);
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(user?.avatar_url || '');
    const [selectedImageForCrop, setSelectedImageForCrop] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        if (!displayName.trim() || displayName.trim().length < 2) {
            setError(t('profile.error_name_min'));
            return;
        }

        setSaving(true);
        setError('');

        try {
            await profileApi.update({
                display_name: displayName.trim(),
            });
            setSuccess(true);
            if (refreshUser) await refreshUser();
            setTimeout(onClose, 1000);
        } catch (err: any) {
            setError(err.message || t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate client-side
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
            setError(t('admin_users.error_image_type'));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError(t('admin_users.error_image_size'));
            return;
        }

        // Open cropper instead of uploading directly
        const imageUrl = URL.createObjectURL(file);
        setSelectedImageForCrop(imageUrl);
        
        // Reset input so the same file could be selected again if needed
        e.target.value = '';
    };

    const handleCropSave = async (croppedFile: File) => {
        setSelectedImageForCrop(null);
        setUploading(true);
        setError('');

        try {
            const result = await profileApi.uploadAvatar(croppedFile);
            setPreviewUrl(result.avatar_url);
            if (refreshUser) await refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || t('profile.error_image_upload'));
        } finally {
            setUploading(false);
        }
    };

    const handleCropCancel = () => {
        if (selectedImageForCrop) {
            URL.revokeObjectURL(selectedImageForCrop);
            setSelectedImageForCrop(null);
        }
    };

    const handleRemoveAvatar = async () => {
        setUploading(true);
        setError('');

        try {
            await profileApi.deleteAvatar();
            setPreviewUrl('');
            if (refreshUser) await refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || t('profile.error_avatar_delete'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl border ${darkMode ? 'bg-navy-800 border-navy-600' : 'bg-white border-gray-200'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-navy-700' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-400" />
                        <h2 className="text-base font-semibold">{t('profile.title')}</h2>
                    </div>
                    <button onClick={onClose} className={`${darkMode ? 'text-navy-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-5">
                    {/* Avatar section - upload */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative group">
                            <UserAvatar
                                name={displayName || user?.display_name}
                                avatarUrl={previewUrl}
                                size="lg"
                            />
                            {/* Overlay with camera icon */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                {uploading ? (
                                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                                ) : (
                                    <Camera className="w-5 h-5 text-white" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                            >
                                {uploading ? t('profile.uploading') : t('profile.upload_photo')}
                            </button>
                            {previewUrl && (
                                <>
                                    <span className={`text-xs ${darkMode ? 'text-navy-600' : 'text-gray-300'}`}>|</span>
                                    <button
                                        onClick={handleRemoveAvatar}
                                        disabled={uploading}
                                        className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> {t('common.delete')}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="text-center">
                            <p className="text-sm font-medium">{user?.display_name}</p>
                            <p className={`text-xs ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>{user?.email}</p>
                            <p className={`text-xs mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'} capitalize`}>
                                {user?.role} • {(user?.departments || []).join(', ').replace(/_/g, ' ') || '—'}
                            </p>
                        </div>
                    </div>

                    {/* Display name */}
                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-navy-300' : 'text-gray-600'}`}>
                            {t('profile.display_name')}
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all ${
                                darkMode
                                    ? 'bg-navy-900/50 border-navy-600 text-white focus:border-blue-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                            }`}
                            placeholder={t('profile.name_placeholder')}
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    {success && <p className="text-green-400 text-xs">✓ {t('profile.updated_success')}</p>}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${darkMode ? 'border-navy-700' : 'border-gray-100'} flex justify-end gap-3`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg text-sm transition-colors ${darkMode ? 'text-navy-300 hover:bg-navy-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? t('task_form.saving') : t('common.save')}
                    </button>
                </div>
            </div>

            {/* Cropper Modal */}
            {selectedImageForCrop && (
                <AvatarCropper
                    imageSrc={selectedImageForCrop}
                    onCancel={handleCropCancel}
                    onSave={handleCropSave}
                />
            )}
        </div>
    );
}
