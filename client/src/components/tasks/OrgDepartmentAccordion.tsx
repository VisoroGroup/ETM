import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Settings, FileText, Users } from 'lucide-react';
import { OrgDepartment, OrgSection, OrgPost, Task } from '../../types';
import OrgPostRow from './OrgPostRow';
import OrgHeadRow from './OrgHeadRow';
import { useTranslation } from '../../i18n/I18nContext';

interface Props {
    department: OrgDepartment;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    darkMode: boolean;
    defaultExpanded?: boolean;
    isSuperAdmin?: boolean;
    onEditDepartment?: (dept: OrgDepartment) => void;
    onEditSection?: (section: OrgSection) => void;
    onEditPost?: (post: OrgPost) => void;
    onPolicyClick?: (scope: string, id?: string) => void;
    onTaskStatusChange?: () => void;
}

export default function OrgDepartmentAccordion({
    department, tasks, onTaskClick, darkMode, defaultExpanded = false,
    isSuperAdmin, onEditDepartment, onEditSection, onEditPost, onPolicyClick, onTaskStatusChange
}: Props) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(defaultExpanded);

    // Tasks assigned directly to this department's head (department scope)
    const deptDirectTasks = tasks.filter(t => t.assigned_department_id === department.id);

    // Count includes all three scopes: post-level, section-head-level, department-head-level.
    // Before this fix, tasks assigned to a section head or department head were
    // invisible in the seven-department layout because only assigned_post_id was checked.
    const deptTaskCount = tasks.filter(t =>
        t.assigned_department_id === department.id
        || (department.sections?.some(s =>
            t.assigned_section_id === s.id
            || s.posts?.some(p => p.id === t.assigned_post_id)
        ) ?? false)
    ).length;

    return (
        <div
            className="rounded-xl border transition-all"
            style={{
                borderColor: department.color + '30',
                background: darkMode
                    ? `linear-gradient(135deg, ${department.color}08 0%, ${department.color}03 100%)`
                    : `linear-gradient(135deg, ${department.color}10 0%, ${department.color}05 100%)`,
            }}
        >
            {/* Department Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:brightness-110"
                style={{
                    background: darkMode
                        ? `linear-gradient(90deg, ${department.color}15 0%, transparent 100%)`
                        : `linear-gradient(90deg, ${department.color}20 0%, transparent 100%)`,
                }}
            >
                {/* Color indicator */}
                <div
                    className="w-1.5 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: department.color }}
                />

                {/* Department name */}
                <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{department.name}</h3>
                        {deptTaskCount > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                darkMode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}>
                                {deptTaskCount} {deptTaskCount === 1 ? t('tasks.task_count_one') : t('tasks.task_count_many')}
                            </span>
                        )}
                    </div>
                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                        {t('tasks.assigned_to')}: {department.head_user_name || '—'}
                    </p>
                </div>

                {/* Policy count — always visible */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPolicyClick?.('DEPARTMENT', department.id); }}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                        (department.policy_count || 0) > 0
                            ? darkMode ? 'text-blue-400 hover:bg-navy-700 hover:text-blue-300' : 'text-blue-500 hover:bg-gray-100'
                            : darkMode ? 'text-navy-600 hover:bg-navy-700 hover:text-navy-400' : 'text-gray-300 hover:bg-gray-100'
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    {(department.policy_count || 0) > 0 ? `${department.policy_count} ${t('org.policy_short')}` : t('org.policy_short')}
                </button>

                {/* Edit button (superadmin) */}
                {isSuperAdmin && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditDepartment?.(department); }}
                        className={`p-1.5 rounded-md transition-colors ${
                            darkMode ? 'text-navy-500 hover:bg-navy-700 hover:text-navy-300' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                )}

                {/* Expand/collapse */}
                <div className={`${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                    {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
            </button>

            {/* Expanded content — sections and posts */}
            {expanded && (
                <div className={`border-t ${darkMode ? 'border-navy-700/30' : 'border-gray-100'}`}>
                    {/* Department-head row: tasks assigned directly to the department head */}
                    <OrgHeadRow
                        scope="department"
                        headUserName={department.head_user_name}
                        headUserAvatar={department.head_user_avatar}
                        tasks={deptDirectTasks}
                        onTaskClick={onTaskClick}
                        onTaskStatusChange={onTaskStatusChange}
                        darkMode={darkMode}
                    />

                    {department.sections?.map((section) => (
                        <OrgSectionBlock
                            key={section.id}
                            section={section}
                            tasks={tasks}
                            onTaskClick={onTaskClick}
                            darkMode={darkMode}
                            isSuperAdmin={isSuperAdmin}
                            departmentColor={department.color}
                            onEditSection={onEditSection}
                            onEditPost={onEditPost}
                            onTaskStatusChange={onTaskStatusChange}
                            onPolicyClick={onPolicyClick}
                        />
                    ))}

                    {/* Department PFV & Statistic */}
                    <div className={`px-5 py-3 text-xs border-t ${
                        darkMode ? 'border-navy-700/30 text-navy-400/80' : 'border-gray-100 text-gray-500'
                    }`}>
                        {department.pfv && (
                            <p className="leading-relaxed"><span className={`font-semibold ${darkMode ? 'text-navy-300' : 'text-gray-600'}`} title={t('org.pfv_tooltip')}>{t('org.pfv_label')}</span> {department.pfv}</p>
                        )}
                        {department.statistic_name && (
                            <p className="mt-1"><span className={`font-semibold ${darkMode ? 'text-navy-300' : 'text-gray-600'}`}>{t('org.statistic_label')}</span> {department.statistic_name}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Section block within a department ---
function OrgSectionBlock({
    section, tasks, onTaskClick, darkMode, isSuperAdmin, departmentColor, onEditSection, onEditPost, onTaskStatusChange, onPolicyClick
}: {
    section: OrgSection;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    darkMode: boolean;
    isSuperAdmin?: boolean;
    departmentColor: string;
    onEditSection?: (section: OrgSection) => void;
    onEditPost?: (post: OrgPost) => void;
    onTaskStatusChange?: () => void;
    onPolicyClick?: (scope: string, id?: string) => void;
}) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(true);

    return (
        <div className={`${darkMode ? 'border-navy-700/20' : 'border-gray-50'}`}>
            {/* Section header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold transition-all"
                style={{
                    color: darkMode ? departmentColor + 'DD' : departmentColor,
                    background: darkMode ? departmentColor + '0A' : departmentColor + '0C',
                }}
            >
                <div className="w-1 h-5 rounded-full opacity-70" style={{ backgroundColor: departmentColor }} />
                <span className="flex-1 text-left uppercase tracking-[0.12em] text-[11px]">{section.name}</span>
                {section.head_user_name && (
                    <span className={`text-xs font-normal ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                        {section.head_user_name}
                    </span>
                )}
                {isSuperAdmin && onEditSection && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditSection(section); }}
                        className="p-1 rounded text-navy-600 hover:text-navy-300 hover:bg-navy-700 transition-colors"
                    >
                        <Settings className="w-3 h-3" />
                    </button>
                )}
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {/* Section-head row: tasks assigned directly to the section head */}
            {expanded && (
                <OrgHeadRow
                    scope="section"
                    headUserName={section.head_user_name}
                    headUserAvatar={section.head_user_avatar}
                    tasks={tasks.filter(t => t.assigned_section_id === section.id)}
                    onTaskClick={onTaskClick}
                    onTaskStatusChange={onTaskStatusChange}
                    darkMode={darkMode}
                />
            )}

            {/* Posts */}
            {expanded && section.posts?.map((post) => (
                <OrgPostRow
                    key={post.id}
                    post={post}
                    tasks={tasks.filter(t => t.assigned_post_id === post.id)}
                    onTaskClick={onTaskClick}
                    darkMode={darkMode}
                    isSuperAdmin={isSuperAdmin}
                    onEditPost={onEditPost}
                    onTaskStatusChange={onTaskStatusChange}
                    onPolicyClick={onPolicyClick}
                />
            ))}

            {/* Section PFV */}
            {expanded && section.pfv && (
                <div className={`px-6 py-1.5 text-[10px] italic ${darkMode ? 'text-navy-400/70' : 'text-gray-400'}`}>
                    <span className={`font-medium not-italic ${darkMode ? 'text-navy-400' : 'text-gray-500'}`} title={t('org.pfv_tooltip')}>{t('org.pfv_label')}</span> {section.pfv}
                </div>
            )}
        </div>
    );
}
