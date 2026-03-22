import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { checklistApi } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import type { ChecklistItem } from '../../../types';
import { Plus, X, GripVertical, Loader2, ListChecks } from 'lucide-react';

interface Props {
    taskId: string;
    checklist: ChecklistItem[];
    onUpdate: () => void;
}

export default function ChecklistTab({ taskId, checklist, onUpdate }: Props) {
    const { showToast } = useToast();
    const [newTitle, setNewTitle] = useState('');
    const [adding, setAdding] = useState(false);

    const checked = checklist.filter(c => c.is_checked).length;
    const total = checklist.length;
    const pct = total > 0 ? (checked / total) * 100 : 0;

    async function addItem() {
        if (!newTitle.trim() || adding) return;
        setAdding(true);
        try {
            await checklistApi.add(taskId, newTitle.trim());
            setNewTitle('');
            onUpdate();
        } catch {
            showToast('Eroare la adăugare', 'error');
        } finally {
            setAdding(false);
        }
    }

    async function toggleCheck(item: ChecklistItem) {
        try {
            await checklistApi.update(taskId, item.id, { is_checked: !item.is_checked });
            onUpdate();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function deleteItem(itemId: string) {
        try {
            await checklistApi.remove(taskId, itemId);
            onUpdate();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function onDragEnd(result: DropResult) {
        if (!result.destination) return;
        const items = Array.from(checklist);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        const order = items.map((item, i) => ({ id: item.id, order_index: i }));
        try {
            await checklistApi.reorder(taskId, order);
            onUpdate();
        } catch {
            showToast('Eroare la reordonare', 'error');
        }
    }

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            {total > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-navy-400">{checked} / {total} completate</span>
                        <span className="text-xs text-navy-500">{Math.round(pct)}%</span>
                    </div>
                    <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Add new item */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
                    placeholder="Adaugă element nou..."
                    maxLength={500}
                    className="flex-1 px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                />
                <button
                    onClick={addItem}
                    disabled={!newTitle.trim() || adding}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors disabled:opacity-30"
                >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
            </div>

            {/* Checklist items with drag & drop */}
            {total > 0 ? (
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="checklist">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                                {checklist.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(dragProvided, snapshot) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                className={`flex items-center gap-2 px-2 py-2 rounded-lg border group transition-all ${
                                                    snapshot.isDragging
                                                        ? 'bg-navy-700/60 border-blue-500/50 shadow-lg'
                                                        : 'bg-navy-800/20 border-navy-700/30 hover:bg-navy-800/40'
                                                }`}
                                            >
                                                <div {...dragProvided.dragHandleProps} className="cursor-grab text-navy-600 hover:text-navy-400">
                                                    <GripVertical className="w-3.5 h-3.5" />
                                                </div>
                                                <button
                                                    onClick={() => toggleCheck(item)}
                                                    className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                        item.is_checked
                                                            ? 'bg-green-500 border-green-500'
                                                            : 'border-navy-500 hover:border-blue-400'
                                                    }`}
                                                    style={{ width: 18, height: 18 }}
                                                >
                                                    {item.is_checked && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <span className={`flex-1 text-sm ${item.is_checked ? 'line-through text-navy-500' : 'text-white'}`}>
                                                    {item.title}
                                                </span>
                                                <button
                                                    onClick={() => deleteItem(item.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-navy-500 hover:text-red-400 transition-all"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            ) : (
                <div className="text-center py-8">
                    <ListChecks className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Nicio verificare adăugată</p>
                    <p className="text-navy-600 text-xs">Adaugă primul element!</p>
                </div>
            )}
        </div>
    );
}
