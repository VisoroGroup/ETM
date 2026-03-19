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
                .rbc-calendar { background: transparent; color: white; font-family: inherit; }
                .rbc-header { background: #1e3a5f; border-color: #243b55 !important; padding: 8px; font-size: 12px; color: #829ab1; }
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border-color: #243b55 !important; }
                .rbc-day-bg { border-color: #243b55 !important; }
                .rbc-off-range-bg { background: rgba(0,0,0,0.15); }
                .rbc-today { background: rgba(59,130,246,0.08) !important; }
                .rbc-button-link { color: #e2e8f0; font-size: 13px; }
                .rbc-date-cell { color: #829ab1; font-size: 12px; padding: 4px; }
                .rbc-date-cell.rbc-now .rbc-button-link { color: #3b82f6; font-weight: bold; }
                .rbc-toolbar { margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
                .rbc-toolbar button { background: #1e3a5f; border: 1px solid #243b55; color: #829ab1; border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer; }
                .rbc-toolbar button:hover { background: #243b55; color: white; }
                .rbc-toolbar button.rbc-active { background: #3b82f6; border-color: #3b82f6; color: white; }
                .rbc-toolbar-label { color: white; font-weight: 600; font-size: 14px; }
                .rbc-show-more { color: #3b82f6; font-size: 11px; background: transparent; }
                
                /* Agenda View Table Customization */
                .rbc-agenda-view table.rbc-agenda-table { border-collapse: collapse !important; border: 1px solid #1e293b !important; }
                .rbc-agenda-table th, .rbc-agenda-table td { border: 1px solid #1e293b !important; padding: 12px 16px !important; font-size: 13px; }
                .rbc-agenda-table thead > tr > th { border-bottom: 2px solid #1e293b !important; background-color: #0d1a29; color: #94a3b8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
                .rbc-agenda-date-cell, .rbc-agenda-time-cell { color: #94a3b8; white-space: nowrap; font-weight: 500; }
                .rbc-agenda-event-cell { padding-left: 12px !important; color: #e2e8f0; }
                .rbc-row-segment { padding: 1px 2px; }
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
