/**
 * Utility to handle complex phone strings from spreadsheets
 * Handles formats like: 
 * - "11999999999 / 1188888888"
 * - "(11) 99999-9999, 11 98888-8888"
 * - "11999999999 11988888888" (Single space separation)
 * - "5551984718338----555134436856" (Hyphen separation)
 */

export const extractPhones = (text: string): string[] => {
    if (!text) return [];

    // 1. Initial cleanup: replace common separators with a standard one
    let standardized = text.replace(/[\/;,\t]| {2,}|-{2,}/g, '|');

    // 2. Handle cases where numbers might be separated by a single space or hyphen but are long enough to be distinct
    standardized = standardized.replace(/(\d)[ -](\d)/g, (match, p1, p2, offset, string) => {
        const before = string.substring(0, offset + 1).split(/[|]/).pop() || '';
        const after = string.substring(offset + 2).split(/[|]/)[0] || '';

        const digitsBefore = before.replace(/\D/g, '').length;
        const digitsAfter = after.replace(/\D/g, '').length;

        // If both sides have at least 8 digits, it's a separator
        if (digitsBefore >= 8 && digitsAfter >= 8) {
            return `${p1}|${p2}`;
        }
        return match;
    });

    // 3. Split by our standard separator
    const parts = standardized.split('|');

    // 4. Clean and filter valid phone numbers
    return parts
        .map(p => {
            let clean = p.trim();
            let digits = clean.replace(/\D/g, '');

            // 1. Remove leading 55 (Brazil country code) if present
            if (digits.startsWith('55') && digits.length >= 12) {
                digits = digits.substring(2);
            }

            // 2. Remove leading 0 if present (common in Brazil local dialing: 011...)
            if (digits.startsWith('0') && digits.length >= 11) {
                digits = digits.substring(1);
            }

            return digits;
        })
        .filter(digits => {
            // Valid phone numbers in Brazil usually have between 8 and 11 digits
            return digits.length >= 8 && digits.length <= 11;
        });
};

/**
 * Normalizes a phone string for database storage
 */
export const normalizePhoneString = (text: string): string => {
    const phones = extractPhones(text);
    if (phones.length === 0) return text;
    return phones.join(' / ');
};
