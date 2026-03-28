/**
 * Attachment Content Extraction Service
 * 
 * Extracts text from various file types (PDF, DOCX, XLSX, CSV, TXT)
 * or returns base64-encoded content for images.
 */
import fs from 'fs';
import path from 'path';
// pdf-parse doesn't export a proper default — use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_TEXT_EXTRACTION_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_LIMIT = 100000; // 100K characters

// Map of extensions to MIME types
const MIME_MAP: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
};

export interface AttachmentMeta {
    id: string;
    task_id: string;
    filename: string;
    file_type: string;
    file_size: number;
    uploaded_by: string;
    uploaded_at: string;
}

export interface ContentResult {
    id: string;
    filename: string;
    file_type: string;
    content: string;
    format: 'text' | 'base64';
    content_length: number;
    truncated: boolean;
    offset: number;
}

/**
 * Resolve the absolute filesystem path for an attachment
 */
export function resolveFilePath(fileUrl: string): string {
    return path.join(UPLOAD_DIR, path.basename(fileUrl));
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Check if the file type is supported for text extraction
 */
function isTextExtractable(ext: string): boolean {
    return ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.md'].includes(ext);
}

/**
 * Check if the file is an image
 */
function isImage(ext: string): boolean {
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
}

/**
 * Extract text content from a file
 */
async function extractText(filePath: string, ext: string): Promise<string> {
    switch (ext) {
        case '.pdf': {
            const buffer = fs.readFileSync(filePath);
            const data = await pdfParse(buffer);
            return data.text || '';
        }

        case '.doc':
        case '.docx': {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value || '';
        }

        case '.xls':
        case '.xlsx': {
            const workbook = XLSX.readFile(filePath);
            const sheets: string[] = [];
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                sheets.push(`--- ${sheetName} ---\n${csv}`);
            }
            return sheets.join('\n\n');
        }

        case '.csv':
        case '.txt':
        case '.md': {
            return fs.readFileSync(filePath, 'utf-8');
        }

        default:
            throw new Error(`Tip de fișier neacceptat pentru extragerea textului: ${ext}`);
    }
}

/**
 * Get attachment content — main entry point
 */
export async function getAttachmentContent(
    fileUrl: string,
    filename: string,
    attachmentId: string,
    format: 'text' | 'base64' = 'text',
    offset = 0,
    limit = DEFAULT_LIMIT
): Promise<ContentResult> {
    const filePath = resolveFilePath(fileUrl);
    const ext = path.extname(filename).toLowerCase();

    // Verify file exists
    if (!fs.existsSync(filePath)) {
        throw Object.assign(new Error('Fișierul nu a fost găsit pe disc.'), { status: 404 });
    }

    const stats = fs.statSync(filePath);

    // Base64 format — for images or explicit request
    if (format === 'base64') {
        if (stats.size > MAX_BASE64_SIZE) {
            throw Object.assign(
                new Error(`Fișierul este prea mare pentru base64 (${(stats.size / 1024 / 1024).toFixed(1)}MB, max ${MAX_BASE64_SIZE / 1024 / 1024}MB).`),
                { status: 413 }
            );
        }

        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');

        return {
            id: attachmentId,
            filename,
            file_type: getMimeType(filename),
            content: base64,
            format: 'base64',
            content_length: base64.length,
            truncated: false,
            offset: 0,
        };
    }

    // Text format
    if (!isTextExtractable(ext) && !isImage(ext)) {
        throw Object.assign(
            new Error(`Tip de fișier neacceptat: ${ext}. Formate suportate: pdf, docx, doc, xlsx, xls, csv, txt, md, jpg, png, gif, webp.`),
            { status: 415 }
        );
    }

    if (isImage(ext)) {
        // Images default to base64 when text is requested
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        return {
            id: attachmentId,
            filename,
            file_type: getMimeType(filename),
            content: base64,
            format: 'base64',
            content_length: base64.length,
            truncated: false,
            offset: 0,
        };
    }

    if (stats.size > MAX_TEXT_EXTRACTION_SIZE) {
        throw Object.assign(
            new Error(`Fișierul este prea mare pentru extragere (${(stats.size / 1024 / 1024).toFixed(1)}MB, max ${MAX_TEXT_EXTRACTION_SIZE / 1024 / 1024}MB).`),
            { status: 413 }
        );
    }

    // Extract text
    const fullText = await extractText(filePath, ext);

    // Apply offset/limit pagination
    const sliced = fullText.substring(offset, offset + limit);
    const truncated = (offset + limit) < fullText.length;

    return {
        id: attachmentId,
        filename,
        file_type: getMimeType(filename),
        content: sliced,
        format: 'text',
        content_length: fullText.length,
        truncated,
        offset,
    };
}
