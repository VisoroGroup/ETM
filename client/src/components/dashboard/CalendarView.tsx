import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Task, STATUSES, DEPARTMENTS } from '../../types';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const locales = { 'ro': ro };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface Props {
    tasks: Task[];
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

export default function CalendarView({ tasks }: Props) {
    const navigate = useNavigate();
    const [view, setView] = useState<View>('month');
    const [date, setDate] = useState(new Date());

    const events = tasks
        .filter(t => t.due_date)
        .map(t => ({
            id: t.id,
            title: t.title,
            start: new Date(t.due_date!),
            end: new Date(t.due_date!),
            resource: t,
        }));

    const eventStyleGetter = (event: any) => {
        const task: Task = event.resource;
        const dept = DEPARTMENTS[task.department_label];
        const isOverdue = new Date(task.due_date!) < new Date() && task.status !== 'terminat';
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
                backgroundColor: bgColor,
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '11px',
                padding: '2px 6px',
                opacity: task.status === 'terminat' ? 0.5 : 1,
            }
        };
    };

    const CustomAgendaEvent = ({ event }: any) => {
        const task: Task = event.resource;
        const dept = DEPARTMENTS[task.department_label];
        const isOverdue = new Date(task.due_date!) < new Date() && task.status !== 'terminat';
        const dotColor = isOverdue ? '#ef4444' : (dept?.color || '#3b82f6');
        return (
            <div className="flex items-center gap-2.5">
                {isOverdue ? (
                    <div className="relative flex items-center justify-center flex-shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40 animate-ping"></span>
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 relative z-10" />
                    </div>
                ) : (
                    <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: dotColor }} />
                )}
                <span className={`${task.status === 'terminat' ? 'opacity-50 line-through' : ''} ${isOverdue ? 'text-red-400 font-semibold' : ''}`}>
                    {event.title}
                </span>
            </div>
        );
    };

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
                style={{ height: 480 }}
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
                    navigate('/tasks', { state: { openTaskId: event.id } });
                }}
                popup
                tooltipAccessor={(event: any) => {
                    const task = event.resource as Task;
                    return `${task.title} — ${STATUSES[task.status]?.label || task.status}`;
                }}
            />
        </div>
    );
}
