#!/usr/bin/env node
/**
 * ETM Task Manager — MCP Server
 * 
 * Model Context Protocol server that connects to the ETM REST API.
 * Provides tools to query and manage tasks directly from AI assistants.
 * 
 * Usage:
 *   ETM_API_URL=https://etm-production-62a7.up.railway.app ETM_API_TOKEN=<token> node etm-mcp-server.mjs
 * 
 * Or locally:
 *   ETM_API_URL=http://localhost:3001 ETM_API_TOKEN=<token> node etm-mcp-server.mjs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env.ETM_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.ETM_API_TOKEN;

if (!API_TOKEN) {
    console.error('❌ ETM_API_TOKEN environment variable is required.');
    console.error('Generate a token in the ETM Admin Panel → Token-uri API.');
    process.exit(1);
}

// --- HTTP helper ---
async function apiCall(method, path, body = null) {
    const url = `${API_URL}/api/v1${path}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || `API error: ${res.status}`);
    }
    return data;
}

// --- MCP Server ---
const server = new Server(
    { name: 'etm-task-manager', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// --- Tool Definitions ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'list_projects',
            description: 'Listázza a Visoro projekteket (departamenteket). Visszaadja az összes projekt nevét és azonosítóját.',
            inputSchema: { type: 'object', properties: {} },
        },
        {
            name: 'list_users',
            description: 'Listázza az aktív felhasználókat (csapattagokat). Hasznos a felelős szűrőhöz.',
            inputSchema: { type: 'object', properties: {} },
        },
        {
            name: 'list_tasks',
            description: 'Listázza a feladatokat szűrőkkel. Alapértelmezetten kihagyja a befejezett feladatokat.',
            inputSchema: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        description: 'Szűrés státuszra. Lehetséges értékek: de_rezolvat (megoldandó), in_realizare (folyamatban), terminat (befejezett), blocat (blokkolt). Vesszővel elválasztva több is megadható.',
                    },
                    department: {
                        type: 'string',
                        description: 'Szűrés departamentre (projekt). Pl: departament_1, departament_2, stb.',
                    },
                    assigned_to: {
                        type: 'string',
                        description: 'Szűrés felelős felhasználó ID-jére.',
                    },
                    search: {
                        type: 'string',
                        description: 'Keresés a feladat címében és leírásában.',
                    },
                    due_before: {
                        type: 'string',
                        description: 'Szűrés: határidő ezen dátum előtt (YYYY-MM-DD).',
                    },
                    due_after: {
                        type: 'string',
                        description: 'Szűrés: határidő ezen dátum után (YYYY-MM-DD).',
                    },
                    include_completed: {
                        type: 'string',
                        description: 'Ha "true", a befejezett feladatokat is visszaadja.',
                    },
                    page: { type: 'string', description: 'Oldalszám (alapértelmezett: 1).' },
                    limit: { type: 'string', description: 'Elemek száma oldalanként (max 100, alapértelmezett: 50).' },
                },
            },
        },
        {
            name: 'get_task',
            description: 'Lekérdezi egy feladat részletes adatait: leírás, státusz, felelős, határidő, subtaskok, kommentek, alerts.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: { type: 'string', description: 'A feladat UUID azonosítója.' },
                },
                required: ['task_id'],
            },
        },
        {
            name: 'update_task_status',
            description: 'Megváltoztatja egy feladat státuszát. Ha "blocat"-ra állítod, kötelező megadni az okot (reason).',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: { type: 'string', description: 'A feladat UUID azonosítója.' },
                    status: {
                        type: 'string',
                        description: 'Új státusz: de_rezolvat | in_realizare | terminat | blocat',
                        enum: ['de_rezolvat', 'in_realizare', 'terminat', 'blocat'],
                    },
                    reason: { type: 'string', description: 'Indoklás (kötelező "blocat" státuszhoz).' },
                },
                required: ['task_id', 'status'],
            },
        },
        {
            name: 'update_task_assignee',
            description: 'Megváltoztatja egy feladat felelősét.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: { type: 'string', description: 'A feladat UUID azonosítója.' },
                    assigned_to: { type: 'string', description: 'A felelős felhasználó UUID-ja. Hagyd üresen a felelős eltávolításához.' },
                },
                required: ['task_id'],
            },
        },
        {
            name: 'add_comment',
            description: 'Hozzáad egy kommentet egy feladathoz.',
            inputSchema: {
                type: 'object',
                properties: {
                    task_id: { type: 'string', description: 'A feladat UUID azonosítója.' },
                    content: { type: 'string', description: 'A komment szövege.' },
                },
                required: ['task_id', 'content'],
            },
        },
        {
            name: 'get_summary',
            description: 'Összesítő nézet: hány feladat van státuszonként, melyek csúsznak, ki mennyit visz. Ez a legjobb indulópont ha általános áttekintés kell.',
            inputSchema: { type: 'object', properties: {} },
        },
    ],
}));

// --- Tool Handlers ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'list_projects': {
                const data = await apiCall('GET', '/projects');
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'list_users': {
                const data = await apiCall('GET', '/users');
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'list_tasks': {
                const params = new URLSearchParams();
                for (const [key, val] of Object.entries(args || {})) {
                    if (val) params.set(key, String(val));
                }
                const qs = params.toString();
                const data = await apiCall('GET', `/tasks${qs ? '?' + qs : ''}`);
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'get_task': {
                const data = await apiCall('GET', `/tasks/${args.task_id}`);
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'update_task_status': {
                const data = await apiCall('PUT', `/tasks/${args.task_id}`, {
                    status: args.status,
                    reason: args.reason || undefined,
                });
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'update_task_assignee': {
                const data = await apiCall('PUT', `/tasks/${args.task_id}`, {
                    assigned_to: args.assigned_to || null,
                });
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'add_comment': {
                const data = await apiCall('POST', `/tasks/${args.task_id}/comments`, {
                    content: args.content,
                });
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            case 'get_summary': {
                const data = await apiCall('GET', '/summary');
                return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
            }

            default:
                return { content: [{ type: 'text', text: `Ismeretlen tool: ${name}` }], isError: true };
        }
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Hiba: ${error.message}` }],
            isError: true,
        };
    }
});

// --- Start ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`✅ ETM MCP Server started (API: ${API_URL})`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
