import React from 'react';
import { STATUSES, TaskStatus } from '../../types';

interface Node {
    id: string;
    title: string;
    status: TaskStatus;
    level: number; // column: negative = blockers, 0 = current, positive = blocked
}

interface Edge {
    from: string;
    to: string;
    /** true when the edge is inert because one side is terminat */
    resolved: boolean;
}

interface Dep {
    id: string;
    blocking_task_id: string;
    blocking_task_title?: string;
    blocking_task_status?: TaskStatus;
    blocked_task_id: string;
    blocked_task_title?: string;
    blocked_task_status?: TaskStatus;
}

interface Props {
    currentTaskId: string;
    currentTaskTitle: string;
    currentTaskStatus: TaskStatus;
    blockedBy: Dep[];
    blocks: Dep[];
    onNodeClick?: (taskId: string) => void;
}

/**
 * Minimal SVG dependency graph.
 * Three columns:
 *   left  = tasks that block the current one (blockedBy)
 *   center = current task
 *   right = tasks the current one blocks
 *
 * No external graph library — SVG + flex math is plenty for 3 columns.
 */
export default function DependencyGraph({
    currentTaskId, currentTaskTitle, currentTaskStatus,
    blockedBy, blocks, onNodeClick
}: Props) {
    // Build node list
    const nodes: Node[] = [
        { id: currentTaskId, title: currentTaskTitle, status: currentTaskStatus, level: 0 },
        ...blockedBy.map(d => ({
            id: d.blocking_task_id,
            title: d.blocking_task_title || '(fără titlu)',
            status: (d.blocking_task_status || 'de_rezolvat') as TaskStatus,
            level: -1,
        })),
        ...blocks.map(d => ({
            id: d.blocked_task_id,
            title: d.blocked_task_title || '(fără titlu)',
            status: (d.blocked_task_status || 'de_rezolvat') as TaskStatus,
            level: 1,
        })),
    ];

    const edges: Edge[] = [
        ...blockedBy.map(d => ({
            from: d.blocking_task_id,
            to: currentTaskId,
            resolved: d.blocking_task_status === 'terminat',
        })),
        ...blocks.map(d => ({
            from: currentTaskId,
            to: d.blocked_task_id,
            resolved: d.blocked_task_status === 'terminat',
        })),
    ];

    // Layout: columns by level. Place nodes vertically within their column.
    const cardWidth = 220;
    const cardHeight = 64;
    const columnGap = 80;
    const rowGap = 16;

    const columns: Record<number, Node[]> = { [-1]: [], 0: [], 1: [] };
    for (const n of nodes) {
        if (!columns[n.level]) columns[n.level] = [];
        columns[n.level].push(n);
    }

    // For each column, assign y positions centered
    const nodePos: Record<string, { x: number; y: number }> = {};
    const levels = [-1, 0, 1];
    const maxRows = Math.max(1, ...levels.map(l => columns[l]?.length ?? 0));
    const totalHeight = maxRows * cardHeight + (maxRows - 1) * rowGap;

    levels.forEach((level, colIdx) => {
        const colNodes = columns[level] || [];
        const count = colNodes.length;
        const colHeight = count * cardHeight + (count - 1) * rowGap;
        const startY = (totalHeight - colHeight) / 2;
        colNodes.forEach((n, i) => {
            nodePos[n.id] = {
                x: colIdx * (cardWidth + columnGap),
                y: startY + i * (cardHeight + rowGap),
            };
        });
    });

    const totalWidth = 3 * cardWidth + 2 * columnGap;

    // Only render graph if there's at least one dep
    if (blockedBy.length === 0 && blocks.length === 0) {
        return (
            <div className="text-center py-6 text-xs text-navy-500 italic">
                Nu există dependențe pentru această sarcină.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto bg-navy-800/20 border border-navy-700/40 rounded-xl p-4">
            <svg width={totalWidth} height={Math.max(totalHeight, cardHeight)} className="mx-auto">
                <defs>
                    <marker id="arrow-red" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#f87171" />
                    </marker>
                    <marker id="arrow-green" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80" />
                    </marker>
                </defs>

                {/* Edges first so they sit under the cards */}
                {edges.map((edge, i) => {
                    const fromPos = nodePos[edge.from];
                    const toPos = nodePos[edge.to];
                    if (!fromPos || !toPos) return null;
                    const x1 = fromPos.x + cardWidth;
                    const y1 = fromPos.y + cardHeight / 2;
                    const x2 = toPos.x;
                    const y2 = toPos.y + cardHeight / 2;
                    // Smooth cubic curve between columns
                    const ctrlOffset = (x2 - x1) / 2;
                    const d = `M ${x1} ${y1} C ${x1 + ctrlOffset} ${y1}, ${x2 - ctrlOffset} ${y2}, ${x2} ${y2}`;
                    return (
                        <path
                            key={i}
                            d={d}
                            stroke={edge.resolved ? '#4ade80' : '#f87171'}
                            strokeWidth={2}
                            fill="none"
                            strokeDasharray={edge.resolved ? '4 3' : undefined}
                            opacity={edge.resolved ? 0.5 : 0.9}
                            markerEnd={edge.resolved ? 'url(#arrow-green)' : 'url(#arrow-red)'}
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map(n => {
                    const p = nodePos[n.id];
                    if (!p) return null;
                    const isCurrent = n.id === currentTaskId;
                    const statusColor = STATUSES[n.status]?.color || '#627d98';
                    return (
                        <g
                            key={n.id}
                            transform={`translate(${p.x}, ${p.y})`}
                            onClick={() => !isCurrent && onNodeClick?.(n.id)}
                            style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                        >
                            <rect
                                width={cardWidth}
                                height={cardHeight}
                                rx={10}
                                fill={isCurrent ? '#1e40af33' : '#243b5399'}
                                stroke={isCurrent ? '#3b82f6' : statusColor + '77'}
                                strokeWidth={isCurrent ? 2 : 1}
                            />
                            {/* Status dot */}
                            <circle cx={12} cy={18} r={4} fill={statusColor} />
                            {/* Title (SVG doesn't truncate — we'll clip manually) */}
                            <foreignObject x={24} y={6} width={cardWidth - 32} height={32}>
                                <div
                                    
                                    style={{
                                        color: '#fff',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        lineHeight: '14px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}
                                    title={n.title}
                                >
                                    {n.title}
                                </div>
                            </foreignObject>
                            {/* Status label */}
                            <foreignObject x={12} y={40} width={cardWidth - 20} height={20}>
                                <div
                                    
                                    style={{
                                        color: statusColor,
                                        fontSize: 10,
                                        fontWeight: 500,
                                    }}
                                >
                                    {STATUSES[n.status]?.label}
                                </div>
                            </foreignObject>
                            {isCurrent && (
                                <foreignObject x={cardWidth - 60} y={4} width={56} height={16}>
                                    <div
                                        
                                        style={{
                                            color: '#93c5fd',
                                            fontSize: 9,
                                            fontWeight: 700,
                                            textAlign: 'right',
                                        }}
                                    >
                                        ACTUAL
                                    </div>
                                </foreignObject>
                            )}
                        </g>
                    );
                })}
            </svg>
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-navy-400">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0.5 bg-red-400" /> blochează
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0.5 bg-green-400 opacity-50" style={{ borderTop: '1px dashed #4ade80' }} /> rezolvat
                </span>
            </div>
        </div>
    );
}
