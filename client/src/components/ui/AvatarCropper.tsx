import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/cropImage';
import { X, Check } from 'lucide-react';
import { Area } from 'react-easy-crop';

interface AvatarCropperProps {
    imageSrc: string;
    onCancel: () => void;
    onSave: (croppedFile: File) => void;
}

export default function AvatarCropper({ imageSrc, onCancel, onSave }: AvatarCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!croppedAreaPixels) return;
        setIsSaving(true);
        try {
            const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
            onSave(croppedImageFile);
        } catch (e) {
            console.error('Cropping error:', e);
            setIsSaving(false);
            alert('A apărut o eroare la decuparea imaginii.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
            <div className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700/50 bg-navy-800/50">
                    <h3 className="text-lg font-bold text-white">Selectează vizualizarea</h3>
                    <button onClick={onCancel} className="text-navy-400 hover:text-white transition-colors p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="relative w-full h-[400px] bg-black">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1} // 1:1 specifically for avatars
                        cropShape="round" // round mask to preview
                        showGrid={false}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>

                {/* Controls & Footer */}
                <div className="p-5 flex flex-col gap-5 border-t border-navy-700/50 bg-navy-800/50">
                    
                    {/* Zoom slider */}
                    <div className="flex items-center justify-center gap-4">
                        <span className="text-xs text-navy-400 font-medium">Zoom</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-1/2 h-1 bg-navy-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-2">
                        <button
                            onClick={onCancel}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm text-navy-300 hover:text-white hover:bg-navy-700 rounded-lg transition-colors font-medium"
                        >
                            Anulează
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Se decupează...' : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Salvează Avatarul
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
