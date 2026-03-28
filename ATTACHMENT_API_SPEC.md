# ETM Attachment Content API — Implementation Specification

**Prepared by:** Visoro / Cowork
**Date:** 2026-03-28
**Priority:** High
**Scope:** 2 new REST endpoints + 2 new MCP tools

---

## Context

The ETM Task Manager already exposes a full REST API (`/api/v1`) and an MCP server that allows AI assistants (Claude/Cowork) to read tasks, update statuses, manage assignees, and add comments. Task attachments are already stored in the database (`task_attachments` table) and served as static files under `/uploads`.

**The gap:** when `get_task` returns attachment metadata (filename, size, uploader), the MCP client has no way to retrieve the actual file content. This means an AI assistant can see that a contract or specification is attached to a task, but cannot read it — breaking the workflow at the most valuable point.

---

## What to Build

### Endpoint 1: `GET /api/v1/tasks/:taskId/attachments`

List all attachments for a given task. This is a convenience endpoint — `get_task` already includes attachment metadata, but a dedicated endpoint enables listing without fetching the full task payload.

**Authentication:** Bearer API token (existing `apiTokenAuth` middleware)

**Response:**

```json
{
  "attachments": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "filename": "Szerzodes_Corund_CartInspect.pdf",
      "file_type": "application/pdf",
      "file_size": 245000,
      "uploaded_by": "Maria VASZI",
      "uploaded_at": "2026-03-28T10:30:00Z"
    }
  ]
}
```

**Notes:**
- `file_type` should be derived from the file extension using the `mime` package (already in node_modules)
- Returns `404` if task not found, empty array if no attachments

---

### Endpoint 2: `GET /api/v1/attachments/:attachmentId/content`

Return the content of an attachment in a machine-readable format.

**Authentication:** Bearer API token (existing `apiTokenAuth` middleware)

**Query parameters:**

| Param    | Type   | Default  | Description |
|----------|--------|----------|-------------|
| `format` | string | `"text"` | `"text"` for extracted text, `"base64"` for raw binary |
| `offset` | number | `0`      | Character offset for pagination (text format only) |
| `limit`  | number | `100000` | Max characters to return (text format only) |

**Response:**

```json
{
  "id": "uuid",
  "filename": "Szerzodes_Corund_CartInspect.pdf",
  "file_type": "application/pdf",
  "content": "A szerzodes szoveges tartalma...",
  "format": "text",
  "content_length": 45000,
  "truncated": false,
  "offset": 0
}
```

**Server-side conversion logic by file type:**

| File extension        | Conversion                        | Recommended library             |
|-----------------------|-----------------------------------|---------------------------------|
| `.pdf`                | Extract text                      | `pdf-parse` or `pdfjs-dist`     |
| `.docx`               | Extract text                      | `mammoth`                       |
| `.doc`                | Extract text                      | `mammoth` or `antiword` (CLI)   |
| `.xlsx`, `.xls`       | Convert to CSV or markdown table  | `xlsx` (SheetJS)                |
| `.csv`, `.txt`, `.md` | Return raw text                   | `fs.readFile` (utf-8)           |
| `.png`, `.jpg`, `.gif`, `.webp` | Return as base64       | `fs.readFile` + `Buffer.toString('base64')` |
| Other                 | Return `415 Unsupported Media Type` | — |

**Constraints:**
- Max file size for text extraction: **10 MB** (reject larger files with `413`)
- Max response content length: **100 KB** text per request (use `offset`/`limit` for pagination)
- Base64 responses: max **5 MB** source file
- Verify the attachment belongs to an existing, non-deleted task

---

## MCP Tools to Add

Add these two tools to `etm-mcp-server.mjs`, following the existing pattern:

### Tool: `list_attachments`

```javascript
{
    name: 'list_attachments',
    description: 'Listazza egy feladat csatolmanyait (fajlnev, meret, feltolto). Hasznos mielott a tartalmat lekered.',
    inputSchema: {
        type: 'object',
        properties: {
            task_id: { type: 'string', description: 'A feladat UUID azonositoja.' },
        },
        required: ['task_id'],
    },
}
```

Handler: `GET /tasks/${args.task_id}/attachments`

### Tool: `get_attachment_content`

```javascript
{
    name: 'get_attachment_content',
    description: 'Lekeri egy csatolt fajl tartalmat szovegkent (PDF, DOCX, XLSX, TXT) vagy base64-kent (kepek). Nagy fajloknal lapozhato offset/limit parameterekkel.',
    inputSchema: {
        type: 'object',
        properties: {
            attachment_id: { type: 'string', description: 'A csatolmany UUID azonositoja.' },
            format: {
                type: 'string',
                description: 'Visszaadasi formatum: "text" (alapertelmezett) vagy "base64".',
                enum: ['text', 'base64'],
            },
            offset: { type: 'number', description: 'Karakter offset a lapozashoz (csak text formatumnal).' },
            limit: { type: 'number', description: 'Max karakterek szama (alapertelmezett: 100000).' },
        },
        required: ['attachment_id'],
    },
}
```

Handler: `GET /attachments/${args.attachment_id}/content?format=...&offset=...&limit=...`

---

## Implementation Notes

### Where to add the REST endpoints

File: `server/src/routes/externalApi.ts`

Both endpoints go into the existing `externalApi` router (already protected by `apiTokenAuth`).

The attachment content extraction logic should be a separate service file (e.g., `server/src/services/attachmentContentService.ts`) to keep the route handler clean.

### Existing infrastructure to reuse

- **`task_attachments` table** — already stores `id`, `task_id`, `file_name`, `file_url`, `file_size`, `uploaded_by`, `created_at`
- **`/uploads` directory** — files are already stored here with multer
- **`apiTokenAuth` middleware** — same auth for all `/api/v1` routes
- **`asyncHandler` wrapper** — existing error handling pattern

### File path resolution

Attachments are stored with `file_url` as a relative URL path (e.g., `/uploads/1234-filename.pdf`). To read the file on disk, resolve against the uploads directory:

```typescript
const filePath = path.join(UPLOADS_DIR, path.basename(attachment.file_url));
```

### Security considerations

1. **Path traversal prevention** — always use `path.basename()` on the stored URL before resolving the filesystem path
2. **Same auth** — reuse the existing API token auth; the token inherits the creator's permissions
3. **File size guard** — reject extraction requests for files larger than the configured max
4. **Task ownership** — verify the attachment's parent task exists and is not deleted

---

## Acceptance Criteria

1. `GET /api/v1/tasks/:taskId/attachments` returns attachment metadata array
2. `GET /api/v1/attachments/:id/content` returns extracted text for PDF, DOCX, XLSX, TXT, CSV, MD files
3. `GET /api/v1/attachments/:id/content?format=base64` returns base64-encoded content for images
4. Large files are paginated via `offset`/`limit` with `truncated: true` indicator
5. Both endpoints are accessible from the MCP server as `list_attachments` and `get_attachment_content` tools
6. Unsupported file types return `415` with a clear error message
7. Oversized files return `413` with the size limit in the error message
8. All requests are logged in `activity_log` (consistent with existing patterns)

---

## User Story

**Before (current):**
> Robert: "Cowork, nezd meg az Alisa szerzodes taskot es keszitsd el a draftot a csatolt minta alapjan."
> Cowork: "Latok egy csatolmanyt (Szerzodes_minta.pdf), de nem tudom elolvasni a tartalmat. Kuldd el kulon."

**After (with this feature):**
> Robert: "Cowork, nezd meg az Alisa szerzodes taskot es keszitsd el a draftot a csatolt minta alapjan."
> Cowork: *Lekeri a taskot → latja a csatolmanyt → lekeri a PDF tartalmat → megirja a draft szerzodest*
