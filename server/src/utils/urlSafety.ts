import dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve4);

/**
 * Synchronous URL safety check — protocol/hostname/IP literal validation.
 * Used both at subscription registration (routes/webhooks.ts) and at every
 * delivery time (services/webhookService.ts) so a webhook URL that resolves
 * to a private/metadata address cannot be exploited via DNS rebinding.
 */
export function validateWebhookUrlSync(urlStr: string): { valid: boolean; error?: string } {
    let parsed: URL;
    try {
        parsed = new URL(urlStr);
    } catch {
        return { valid: false, error: 'URL formátum érvénytelen.' };
    }

    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Production-ben csak HTTPS webhook URL engedélyezett.' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Csak HTTP/HTTPS protokoll engedélyezett.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    const blockedHostnames = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'];
    if (blockedHostnames.includes(hostname)) {
        return { valid: false, error: 'Localhost/loopback webhook URL nem engedélyezett.' };
    }

    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
        const [, a, b] = ipMatch.map(Number);
        if (
            a === 10 ||
            a === 127 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 169 && b === 254) ||
            a === 0
        ) {
            return { valid: false, error: 'Privát/belső IP cím nem engedélyezett webhook URL-ként.' };
        }
    }

    const v6Lower = hostname.replace(/^\[|\]$/g, '');
    if (
        v6Lower.startsWith('::ffff:127.') ||
        v6Lower.startsWith('::ffff:10.') ||
        v6Lower.startsWith('::ffff:192.168.') ||
        /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(v6Lower) ||
        v6Lower.startsWith('fe80:') ||
        v6Lower.startsWith('fc') ||
        v6Lower.startsWith('fd') ||
        v6Lower === '::' ||
        v6Lower === '::1'
    ) {
        return { valid: false, error: 'IPv6 privát/loopback cím nem engedélyezett webhook URL-ként.' };
    }

    return { valid: true };
}

/**
 * Full URL safety check including DNS resolution. Use this on the delivery
 * path right before issuing the HTTP request — guards against DNS rebinding
 * (registration resolves to a public IP, delivery resolves to 169.254.169.254).
 */
export async function validateWebhookUrlAsync(urlStr: string): Promise<{ valid: boolean; error?: string }> {
    const syncResult = validateWebhookUrlSync(urlStr);
    if (!syncResult.valid) return syncResult;

    const hostname = new URL(urlStr).hostname;
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return { valid: true };

    try {
        const addresses = await dnsResolve(hostname);
        for (const ip of addresses) {
            const [a, b] = ip.split('.').map(Number);
            if (
                a === 10 || a === 127 || a === 0 ||
                (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) ||
                (a === 169 && b === 254)
            ) {
                return { valid: false, error: `A domain (${hostname}) belső IP-re oldódik fel (${ip}).` };
            }
        }
    } catch (err) {
        console.warn('[webhook] DNS resolution failed for', hostname, err);
        return { valid: false, error: `DNS feloldás sikertelen: ${hostname}.` };
    }
    return { valid: true };
}
