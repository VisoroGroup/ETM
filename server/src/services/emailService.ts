import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

let graphClient: Client | null = null;
let initPromise: Promise<Client> | null = null;

/**
 * Get or create Microsoft Graph client (application credentials).
 * Thread-safe: concurrent calls wait for the same init promise.
 */
function getGraphClient(): Client {
    if (graphClient) return graphClient;

    // Synchronous init — no race condition possible in single-threaded Node,
    // but guard against double-init just in case
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Missing Azure credentials: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET');
    }

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default'],
    });

    graphClient = Client.initWithMiddleware({ authProvider });
    return graphClient;
}

/**
 * The sender email — must be a valid Microsoft 365 mailbox in your tenant.
 * Set GRAPH_SENDER_EMAIL in Railway Variables.
 * Example: notifications@visoro.ro
 */
const SENDER_EMAIL = process.env.GRAPH_SENDER_EMAIL || 'notifications@visoro-global.ro';

/**
 * Custom error class for email sending failures.
 * Callers can check `retryable` to decide on retry.
 */
export class EmailSendError extends Error {
    public readonly retryable: boolean;
    public readonly statusCode?: number;
    constructor(message: string, retryable: boolean, statusCode?: number) {
        super(message);
        this.name = 'EmailSendError';
        this.retryable = retryable;
        this.statusCode = statusCode;
    }
}

/**
 * Send an email using Microsoft Graph API (Mail.Send application permission)
 */
export async function sendEmail(params: {
    to: string;
    subject: string;
    htmlBody: string;
    displayName?: string;
}): Promise<void> {
    const message = {
        subject: params.subject,
        body: {
            contentType: 'HTML',
            content: params.htmlBody,
        },
        toRecipients: [
            {
                emailAddress: {
                    address: params.to,
                    name: params.displayName || params.to,
                },
            },
        ],
    };

    try {
        const client = getGraphClient();
        await client
            .api(`/users/${SENDER_EMAIL}/sendMail`)
            .post({ message, saveToSentItems: false });
    } catch (err: any) {
        const statusCode = err?.statusCode || err?.code;
        const errMessage = err?.message || 'Unknown email error';

        // Log the error
        console.error(`[EMAIL] Failed to send to ${params.to}:`, errMessage);

        // Token expired or invalid credentials — reset client for next attempt
        if (statusCode === 401 || statusCode === 403 || errMessage.includes('token')) {
            console.warn('[EMAIL] Token/auth error — resetting Graph client for next call.');
            graphClient = null; // Force re-initialization with fresh token
            throw new EmailSendError(`Auth error: ${errMessage}`, true, statusCode);
        }

        // Rate limiting — retryable
        if (statusCode === 429) {
            throw new EmailSendError(`Rate limited: ${errMessage}`, true, 429);
        }

        // Network/timeout errors — retryable
        if (err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT' || err?.code === 'ENOTFOUND') {
            throw new EmailSendError(`Network error: ${errMessage}`, true);
        }

        // All other errors — not retryable (bad request, invalid recipient, etc.)
        throw new EmailSendError(`Email send failed: ${errMessage}`, false, statusCode);
    }
}

/**
 * Send a magic-link login email. Used by the second login flow (external
 * collaborators on gmail/yahoo/etc. who don't have Microsoft 365 accounts).
 *
 * `language` is the recipient's preferred locale. We don't have a user_id
 * yet at request time, so we localise via a small inline dict — this email
 * is short and self-contained.
 */
const MAGIC_LINK_COPY: Record<string, {
    subject: string;
    greeting: string;
    intro: string;
    cta: string;
    expires: string;
    ignore: string;
    footer: string;
}> = {
    ro: {
        subject: '[Sarcinator Visoro] Link de autentificare',
        greeting: 'Bună!',
        intro: 'Cineva a cerut un link de autentificare pentru această adresă de email. Apasă butonul de mai jos pentru a te conecta:',
        cta: 'Conectează-te în Sarcinator',
        expires: 'Linkul este valabil 15 minute și poate fi folosit o singură dată.',
        ignore: 'Dacă nu ai cerut tu acest link, ignoră acest email — nu se va întâmpla nimic.',
        footer: 'Acest email a fost generat automat de Sarcinator Visoro.',
    },
    hu: {
        subject: '[Sarcinator Visoro] Belépési link',
        greeting: 'Szia!',
        intro: 'Valaki belépési linket kért erre az email címre. Kattints a lenti gombra a belépéshez:',
        cta: 'Belépés a Sarcinator-ba',
        expires: 'A link 15 percig érvényes és csak egyszer használható.',
        ignore: 'Ha nem te kérted ezt a linket, hagyd figyelmen kívül ezt az email-t — semmi sem fog történni.',
        footer: 'Ezt az email-t a Sarcinator Visoro automatikusan generálta.',
    },
    en: {
        subject: '[Sarcinator Visoro] Sign-in link',
        greeting: 'Hi!',
        intro: 'Someone requested a sign-in link for this email address. Click the button below to log in:',
        cta: 'Sign in to Sarcinator',
        expires: 'This link is valid for 15 minutes and can only be used once.',
        ignore: 'If you did not request this link, ignore this email — nothing will happen.',
        footer: 'This email was generated automatically by Sarcinator Visoro.',
    },
};

export async function sendMagicLinkEmail(params: {
    to: string;
    link: string;
    language?: 'ro' | 'hu' | 'en';
}): Promise<void> {
    const lang = params.language || 'ro';
    const t = MAGIC_LINK_COPY[lang] || MAGIC_LINK_COPY.ro;
    const safeLink = params.link.replace(/"/g, '&quot;');

    await sendEmail({
        to: params.to,
        subject: t.subject,
        htmlBody: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">Sarcinator Visoro</h1>
                </div>
                <div style="background: white; padding: 28px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; color: #1f2937; margin: 0 0 12px 0;">${t.greeting}</p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">${t.intro}</p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${safeLink}"
                           style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                            ${t.cta}
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 13px; margin: 8px 0;">${t.expires}</p>
                    <p style="color: #6b7280; font-size: 13px; margin: 8px 0;">${t.ignore}</p>
                    <p style="color: #9ca3af; font-size: 11px; word-break: break-all; margin-top: 16px;">${safeLink}</p>
                    <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">${t.footer}</p>
                </div>
            </div>
        `,
    });
}

/**
 * Send a test email to verify Graph API configuration
 */
export async function sendTestEmail(toEmail: string, toName: string): Promise<void> {
    await sendEmail({
        to: toEmail,
        subject: '[Sarcinator Visoro] Test email — configurare Graph API',
        htmlBody: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">Sarcinator Visoro</h1>
                    <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Test email configurare</p>
                </div>
                <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; color: #333;">Bună, <strong>${toName}</strong>!</p>
                    <div style="background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 16px; margin: 16px 0;">
                        <p style="color: #065f46; margin: 0; font-weight: bold;">✅ Configurarea Microsoft Graph API funcționează corect!</p>
                    </div>
                    <p style="color: #666; font-size: 14px;">Vei primi zilnic (Luni-Vineri, ora 07:00) un sumar cu task-urile tale active.</p>
                    <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
                        Această notificare a fost generată automat de Sarcinator Visoro.
                    </p>
                </div>
            </div>
        `,
        displayName: toName,
    });
}
