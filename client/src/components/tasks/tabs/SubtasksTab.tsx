import { useState } from 'react';
import { subtasksApi } from '../../../services/api';
import type { TaskDetail, Subtask, User } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Check, Trash2, GripVertical, CheckCircle2, Calendar } from 'lucide-react';

const PRIORITY_COLORS = {
    low: { dot: 'bg-navy-500', label: 'Scăzut' },
    medium: { dot: 'bg-yellow-400', label: 'Mediu' },
    high: { dot: 'bg-red-400', label: 'Ridicat' },
} as const;

interface Props {
    task: TaskDetail;
    taskId: string;
    onReload: () => void;
    onUpdate: () => void;
}

export default function SubtasksTab({ task, taskId, onReload, onUpdate }: Props) {
    const { users } = useAuth();
    const { showToast } = useToast();
    const [newSubtask, setNewSubtask] = useState('');

    async function addSubtask() {
        if (!newSubtask.trim()) return;
        try {
            await subtasksApi.create(taskId, { title: newSubtask.trim() });
            setNewSubtask('');
            onReload();
            onUpdate();
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    async function toggleSubtask(subtask: Subtask) {
        try {
            await subtasksApi.update(taskId, subtask.id, { is_completed: !subtask.is_completed });
            onReload();
            onUpdate();
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    async function assignSubtask(subtaskId: string, userId: string | null) {
        try {
            await subtasksApi.update(taskId, subtaskId, { assigned_to: userId });
            onReload();
            onUpdate();
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    async function deleteSubtask(subtaskId: string) {
        try {
            await subtasksApi.delete(taskId, subtaskId);
            onReload();
            onUpdate();
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    async function changePriority(subtaskId: string, priority: 'low' | 'medium' | 'high') {
        try {
            await subtasksApi.update(taskId, subtaskId, { priority });
            onReload();
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    async function changeDueDate(subtaskId: string, due_date: string | null) {
        try {
            await subtasksApi.update(taskId, subtaskId, { due_date });
            onReload();
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
        }
    }

    async function onDragEnd(result: DropResult) {
        if (!result.destination) return;
        const items = Array.from(task.subtasks);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        const order = items.map((item, idx) => ({ id: item.id, order_index: idx }));
        try {
            await subtasksApi.reorder(taskId, order);
            onReload();
        } catch {
            showToast('Eroare la reordonare', 'error');
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubtask()}
                    placeholder="Adaugă subtask..."
                    className="flex-1 px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                />
                <button onClick={addSubtask} className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="subtasks">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                            {task.subtasks.map((subtask, index) => (
                                <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${snapshot.isDragging ? 'bg-navy-700/50 shadow-lg' : 'hover:bg-navy-800/30'
                                                }`}
                                        >
                                            <div {...provided.dragHandleProps} className="text-navy-600 hover:text-navy-400 cursor-grab">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                            <button
                                                onClick={() => toggleSubtask(subtask)}
                                                className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${subtask.is_completed
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-navy-600 hover:border-blue-400'
                                                    }`}
                                            >
                                                {subtask.is_completed && <Check className="w-3 h-3 text-white" />}
                                            </button>
                                            <span className={`flex-1 text-sm ${subtask.is_completed ? 'line-through text-navy-500' : ''}`}>
                                                {subtask.title}
                                            </span>

                                            {/* Priority */}
                                            <select
                                                value={subtask.priority || 'medium'}
                                                onChange={e => changePriority(subtask.id, e.target.value as 'low' | 'medium' | 'high')}
                                                onClick={e => e.stopPropagation()}
                                                className="px-1.5 py-0.5 bg-navy-800/50 border border-navy-700/50 rounded text-[10px] text-navy-400 focus:outline-none w-[70px]"
                                            >
                                                <option value="low">⬇ Scăzut</option>
                                                <option value="medium">➡ Mediu</option>
                                                <option value="high">⬆ Ridicat</option>
                                            </select>

                                            {/* Due date */}
                                            <input
                                                type="date"
                                                value={subtask.due_date ? subtask.due_date.slice(0, 10) : ''}
                                                onChange={e => changeDueDate(subtask.id, e.target.value || null)}
                                                onClick={e => e.stopPropagation()}
                                                className="px-1.5 py-0.5 bg-navy-800/50 border border-navy-700/50 rounded text-[10px] text-navy-400 focus:outline-none w-[110px]"
                                            />

                                            {/* Assign user */}
                                            <select
                                                value={subtask.assigned_to || ''}
                                                onChange={e => assignSubtask(subtask.id, e.target.value || null)}
                                                className="px-2 py-1 bg-navy-800/50 border border-navy-700/50 rounded text-[11px] text-navy-300 focus:outline-none max-w-[120px]"
                                            >
                                                <option value="">Neasignat</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.display_name}</option>
                                                ))}
                                            </select>

                                            <button
                                                onClick={() => deleteSubtask(subtask.id)}
                                                className="text-navy-600 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
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

            {task.subtasks.length === 0 && (
                <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Niciun subtask încă</p>
                    <p className="text-navy-600 text-xs">Adaugă subtask-uri pentru a organiza task-ul.</p>
                </div>
            )}
        </div>
    );
}
