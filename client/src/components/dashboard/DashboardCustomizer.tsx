import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { X, GripVertical, RotateCcw, Loader2 } from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import type { WidgetConfig } from '../../types';
import { AVAILABLE_WIDGETS } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    layout: WidgetConfig[];
    onSave: (layout: WidgetConfig[]) => void;
}

export default function DashboardCustomizer({ isOpen, onClose, layout, onSave }: Props) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [items, setItems] = useState<WidgetConfig[]>([...layout]);
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    // Filter out admin-only widgets for non-admin users
    const filteredItems = items.filter(w => {
        const meta = AVAILABLE_WIDGETS[w.widget_id];
        return meta && (!meta.adminOnly || user?.role === 'admin');
    });

    function toggleVisible(widgetId: string) {
        setItems(prev => prev.map(w =>
            w.widget_id === widgetId ? { ...w, visible: !w.visible } : w
        ));
    }

    function onDragEnd(result: DropResult) {
        if (!result.destination) return;
        const arr = Array.from(items);
        const [moved] = arr.splice(result.source.index, 1);
        arr.splice(result.destination.index, 0, moved);
        setItems(arr.map((w, i) => ({ ...w, order: i })));
    }

    async function save() {
        setSaving(true);
        try {
            await dashboardApi.savePreferences(items);
            onSave(items);
            showToast('Preferințe salvate!', 'success');
            onClose();
        } catch {
            showToast('Eroare la salvare', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function reset() {
        try {
            await dashboardApi.savePreferences([]);
            const defaults = await dashboardApi.getPreferences();
            setItems(defaults);
            onSave(defaults);
            showToast('Resetat la implicit', 'success');
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <h2 className="text-base font-bold">Personalizare panou</h2>
                    <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="widgets">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                                    {filteredItems.map((widget, index) => {
                                        const meta = AVAILABLE_WIDGETS[widget.widget_id];
                                        if (!meta) return null;
                                        return (
                                            <Draggable key={widget.widget_id} draggableId={widget.widget_id} index={index}>
                                                {(dragProvided, snapshot) => (
                                                    <div
                                                        ref={dragProvided.innerRef}
                                                        {...dragProvided.draggableProps}
                                                        className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-all ${
                                                            snapshot.isDragging
                                                                ? 'bg-navy-700/60 border-blue-500/50 shadow-lg'
                                                                : 'bg-navy-800/30 border-navy-700/30 hover:bg-navy-800/50'
                                                        }`}
                                                    >
                                                        <div {...dragProvided.dragHandleProps} className="cursor-grab text-navy-500 hover:text-navy-300">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium">{meta.label}</p>
                                                            <p className="text-[11px] text-navy-500 truncate">{meta.description}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => toggleVisible(widget.widget_id)}
                                                            className={`relative w-10 h-5 rounded-full transition-colors ${
                                                                widget.visible ? 'bg-blue-500' : 'bg-navy-700'
                                                            }`}
                                                        >
                                                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                                                widget.visible ? 'translate-x-5' : 'translate-x-0.5'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-5 border-t border-navy-700/50">
                    <button onClick={reset} className="flex items-center gap-1.5 text-sm text-navy-400 hover:text-white transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Resetare
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-5 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Salvează
                    </button>
                </div>
            </div>
        </div>
    );
}
