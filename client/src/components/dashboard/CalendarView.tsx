import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { STATUSES, DEPARTMENTS } from '../../types';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../services/api';
import { AlertTriangle, Loader2 } from 'lucide-react';

const locales = { 'ro': ro };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface CalendarEvent {
    id: string;
    title: string;
    due_date: string;
    status: string;
    department_label: string;
    assigned_to: string | null;
    assignee_name: string | null;
    event_type: 'task' | 'subtask';
    parent_task_id: string | null;
    parent_task_title: string | null;
}

const messages = {
    today: 'Azi',
    previous: '‹',
    next: '›',
    month: 'Lună',
    week: 'Săptămână',
    day: 'Zi',
    agenda: 'Agendă',
    noEventsInRange: 'Nicio sarcină în această perioadă',
    date: 'Data',
    time: 'Ora',
    event: 'Sarcină',
};

export default function CalendarView() {
    const navigate = useNavigate();
    const [view, setView] = useState<View>('month');
    const [date, setDate] = useState(new Date());
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        dashboardApi.calendarEvents()
            .then(data => setCalendarEvents(data))
            .catch(err => console.error('Calendar events error:', err))
            .finally(() => setLoading(false));
    }, []);

    // Sort events so subtasks appear directly after their parent task
    const sortedCalendarEvents = [...calendarEvents].filter(e => e.due_date);

    // Group: parent tasks first (alphabetically), then insert subtasks after their parent
    const parentTasks = sortedCalendarEvents.filter(e => e.event_type !== 'subtask');
    const subtasksByParent = new Map<string, CalendarEvent[]>();
    for (const e of sortedCalendarEvents.filter(e => e.event_type === 'subtask')) {
        const pid = e.parent_task_id || '';
        if (!subtasksByParent.has(pid)) subtasksByParent.set(pid, []);
        subtasksByParent.get(pid)!.push(e);
    }

    // Build ordered list: each parent followed by its subtasks
    const orderedEvents: CalendarEvent[] = [];
    const usedParentIds = new Set<string>();
    for (const parent of parentTasks) {
        orderedEvents.push(parent);
        usedParentIds.add(parent.id);
        const subs = subtasksByParent.get(parent.id);
        if (subs) {
            orderedEvents.push(...subs);
            subtasksByParent.delete(parent.id);
        }
    }
    // Orphan subtasks (parent not in current view)
    for (const [, subs] of subtasksByParent) {
        orderedEvents.push(...subs);
    }

    const events = orderedEvents.map(e => ({
        id: e.id,
        title: e.event_type === 'subtask' ? `↳ ${e.title}` : e.title,
        start: new Date(e.due_date),
        end: new Date(e.due_date),
        resource: e,
    }));

    const eventStyleGetter = (event: any) => {
        const ev: CalendarEvent = event.resource;
        const dept = DEPARTMENTS[ev.department_label as keyof typeof DEPARTMENTS];
        const isOverdue = new Date(ev.due_date) < new Date() && ev.status !== 'terminat';
        const isSubtask = ev.event_type === 'subtask';
        const bgColor = isOverdue ? '#ef4444' : (dept?.color || '#3b82f6');
        
        if (view === 'agenda') {
            return {
                style: {
                    backgroundColor: 'transparent',
                    color: '#e2e8f0',
                }
            };
        }

        return {
            style: {
                backgroundColor: isSubtask ? `${bgColor}99` : bgColor,
                border: isSubtask ? `1px dashed ${bgColor}` : 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '11px',
                padding: '2px 6px',
                opacity: ev.status === 'terminat' ? 0.5 : 1,
                fontStyle: isSubtask ? 'italic' : 'normal',
            }
        };
    };

    const CustomAgendaEvent = ({ event }: any) => {
        const ev: CalendarEvent = event.resource;
        const dept = DEPARTMENTS[ev.department_label as keyof typeof DEPARTMENTS];
        const isOverdue = new Date(ev.due_date) < new Date() && ev.status !== 'terminat';
        const dotColor = isOverdue ? '#ef4444' : (dept?.color || '#3b82f6');
        const isSubtask = ev.event_type === 'subtask';
        return (
            <div className="flex items-center gap-2.5">
                {isOverdue ? (
                    <div className="relative flex items-center justify-center flex-shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40 animate-ping"></span>
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 relative z-10" />
                    </div>
                ) : (
                    <div
                        className={`flex-shrink-0 shadow-sm ${isSubtask ? 'w-2.5 h-2.5 rounded-sm' : 'w-3 h-3 rounded-full'}`}
                        style={{ backgroundColor: dotColor }}
                    />
                )}
                <div className="flex flex-col">
                    <span className={`${ev.status === 'terminat' ? 'opacity-50 line-through' : ''} ${isOverdue ? 'text-red-400 font-semibold' : ''} ${isSubtask ? 'italic' : ''}`}>
                        {isSubtask ? `↳ ${ev.title}` : ev.title}
                    </span>
                    {isSubtask && ev.parent_task_title && (
                        <span className="text-[10px] text-navy-500">
                            din: {ev.parent_task_title}
                        </span>
                    )}
                    {ev.assignee_name && (
                        <span className="text-[10px] text-navy-500">
                            → {ev.assignee_name}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
        );
    }

    return (
        <div className="calendar-wrapper">
            <style>{`
                /* ═══ BASE ═══ */
                .rbc-calendar { background: transparent; color: #e2e8f0; font-family: inherit; }
                
                /* ═══ TOOLBAR ═══ */
                .rbc-toolbar { margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
                .rbc-toolbar button { background: #0f1d2e; border: 1px solid #1e293b; color: #94a3b8; border-radius: 8px; padding: 6px 14px; font-size: 12px; cursor: pointer; transition: all 0.2s ease; }
                .rbc-toolbar button:hover { background: #1e293b; color: #e2e8f0; }
                .rbc-toolbar button.rbc-active { background: #3b82f6; border-color: #3b82f6; color: white; box-shadow: 0 0 12px rgba(59,130,246,0.3); }
                .rbc-toolbar-label { color: white; font-weight: 600; font-size: 15px; letter-spacing: 0.3px; }
                
                /* ═══ SHARED BORDERS ═══ */
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid #1e293b !important; border-radius: 8px; overflow: hidden; }
                .rbc-header { background: #0d1a29; border-color: #1e293b !important; padding: 10px 8px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
                .rbc-header + .rbc-header { border-left: 1px solid #1e293b !important; }
                
                /* ═══ MONTH VIEW ═══ */
                .rbc-month-view .rbc-month-row { border-color: #1e293b !important; }
                .rbc-month-view .rbc-month-row + .rbc-month-row { border-top: 1px solid #1e293b !important; }
                .rbc-day-bg { border-color: #1e293b !important; transition: background 0.15s ease; }
                .rbc-day-bg:hover { background: rgba(59,130,246,0.04); }
                .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1e293b !important; }
                .rbc-off-range-bg { background: rgba(0,0,0,0.12); }
                .rbc-today { background: rgba(59,130,246,0.08) !important; }
                .rbc-date-cell { color: #64748b; font-size: 12px; padding: 6px 8px; text-align: right; }
                .rbc-date-cell.rbc-now .rbc-button-link { color: #3b82f6; font-weight: 700; }
                .rbc-button-link { color: #94a3b8; font-size: 12px; }
                .rbc-off-range .rbc-button-link { color: #334155; }
                .rbc-row-segment { padding: 1px 3px; }
                .rbc-show-more { color: #3b82f6; font-size: 11px; background: transparent !important; font-weight: 500; padding: 2px 4px; }
                
                /* Month view event pills */
                .rbc-event { border: none !important; border-radius: 4px !important; font-size: 11px !important; padding: 2px 6px !important; line-height: 1.4; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
                .rbc-event:hover { filter: brightness(1.15); box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
                .rbc-event-content { font-size: 11px; }
                .rbc-event.rbc-selected { box-shadow: 0 0 0 2px #3b82f6, 0 2px 8px rgba(59,130,246,0.3) !important; }
                
                /* ═══ WEEK & DAY VIEW ═══ */
                .rbc-time-header { border-bottom: 1px solid #1e293b !important; }
                .rbc-time-header-content { border-left: 1px solid #1e293b !important; }
                .rbc-time-header-gutter { border-right: none; }
                .rbc-allday-cell { border-color: #1e293b !important; }
                .rbc-time-content { border-top: 1px solid #1e293b !important; }
                .rbc-time-content > * + * > * { border-left: 1px solid #1e293b !important; }
                .rbc-timeslot-group { border-bottom: 1px solid #1e293b !important; min-height: 50px; }
                .rbc-time-slot { border-top: none !important; }
                .rbc-time-gutter .rbc-timeslot-group { border-bottom: 1px solid #1e293b !important; }
                .rbc-label { color: #64748b; font-size: 11px; padding: 4px 8px; }
                .rbc-current-time-indicator { background-color: #3b82f6; height: 2px; }
                .rbc-current-time-indicator::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; }
                .rbc-day-slot .rbc-event { border: none !important; border-radius: 4px !important; border-left: 3px solid rgba(255,255,255,0.3) !important; }
                .rbc-day-slot .rbc-event-label { font-size: 10px; opacity: 0.8; }
                .rbc-day-slot .rbc-event-content { font-size: 11px; line-height: 1.3; }
                
                /* ═══ AGENDA VIEW ═══ */
                .rbc-agenda-view table.rbc-agenda-table { border-collapse: collapse !important; border: 1px solid #1e293b !important; }
                .rbc-agenda-table th, .rbc-agenda-table td { border: 1px solid #1e293b !important; padding: 12px 16px !important; font-size: 13px; }
                .rbc-agenda-table thead > tr > th { border-bottom: 2px solid #1e293b !important; background-color: #0d1a29; color: #94a3b8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; font-weight: 600; }
                .rbc-agenda-date-cell, .rbc-agenda-time-cell { color: #94a3b8; white-space: nowrap; font-weight: 500; }
                .rbc-agenda-event-cell { padding-left: 12px !important; color: #e2e8f0; }
                .rbc-agenda-empty { color: #64748b; text-align: center; padding: 40px !important; }
                
                /* ═══ OVERLAY / POPUP ═══ */
                .rbc-overlay { background: #0f1d2e !important; border: 1px solid #1e293b !important; border-radius: 8px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; padding: 8px !important; }
                .rbc-overlay-header { border-bottom: 1px solid #1e293b !important; color: #94a3b8; font-size: 12px; padding: 6px 8px !important; }
            `}</style>
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 550 }}
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                culture="ro"
                messages={messages}
                eventPropGetter={eventStyleGetter}
                components={{
                    agenda: {
                        event: CustomAgendaEvent
                    }
                }}
                onSelectEvent={(event: any) => {
                    const ev: CalendarEvent = event.resource;
                    const taskId = ev.event_type === 'subtask' ? ev.parent_task_id : ev.id;
                    if (taskId) {
                        navigate('/tasks', { state: { openTaskId: taskId } });
                    }
                }}
                popup
                tooltipAccessor={(event: any) => {
                    const ev: CalendarEvent = event.resource;
                    const prefix = ev.event_type === 'subtask' ? `[Subtask] ` : '';
                    const statusLabel = STATUSES[ev.status as keyof typeof STATUSES]?.label || ev.status;
                    const assignee = ev.assignee_name ? ` — ${ev.assignee_name}` : '';
                    const parent = ev.parent_task_title ? `\nTask: ${ev.parent_task_title}` : '';
                    return `${prefix}${ev.title} — ${statusLabel}${assignee}${parent}`;
                }}
            />
        </div>
    );
}
