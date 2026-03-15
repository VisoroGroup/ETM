import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Task, STATUSES, DEPARTMENTS } from '../../types';
import { useNavigate } from 'react-router-dom';

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
        return {
            style: {
                backgroundColor: isOverdue ? '#ef4444' : (dept?.color || '#3b82f6'),
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '11px',
                padding: '2px 6px',
                opacity: task.status === 'terminat' ? 0.5 : 1,
            }
        };
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
                .rbc-agenda-table { color: #e2e8f0; }
                .rbc-agenda-date-cell, .rbc-agenda-time-cell { color: #829ab1; white-space: nowrap; }
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
