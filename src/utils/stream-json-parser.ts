import { RawCommitMessage } from '../services/ai/ai.service.js';

/**
 * Incremental JSON parser for streaming AI responses.
 *
 * Designed to extract complete JSON objects from a growing text buffer
 * as tokens arrive from a streaming API. Emits each parsed commit message
 * as soon as its closing brace is detected — without waiting for the
 * entire response to finish.
 *
 * Expected input format: a JSON array of RawCommitMessage objects, e.g.
 * [{"subject": "feat: ...", "body": "..."}, {"subject": "fix: ..."}]
 *
 * The parser tolerates leading/trailing text (markdown fences, etc.)
 * because it scans for the first `[` and then extracts top-level `{…}` pairs.
 */
export class IncrementalJsonParser {
    private buffer = '';
    private arrayStartFound = false;
    private scanPosition = 0;

    /**
     * Feed a new chunk of text into the parser.
     * Returns any newly completed RawCommitMessage objects found in this chunk.
     */
    feed = (chunk: string): RawCommitMessage[] => {
        this.buffer += chunk;
        const results: RawCommitMessage[] = [];

        // Look for the opening '[' of the JSON array
        if (!this.arrayStartFound) {
            const arrayStart = this.buffer.indexOf('[');
            if (arrayStart === -1) {
                return results;
            }
            this.arrayStartFound = true;
            this.scanPosition = arrayStart + 1;
        }

        // Extract complete top-level objects within the array
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const objectStart = this.buffer.indexOf('{', this.scanPosition);
            if (objectStart === -1) {
                break;
            }

            const extracted = this.extractBalancedBraces(objectStart);
            if (!extracted) {
                // Object is incomplete — wait for more data
                break;
            }

            this.scanPosition = objectStart + extracted.length;

            const parsed = this.tryParseCommitMessage(extracted);
            if (parsed) {
                results.push(parsed);
            }
        }

        return results;
    };

    /**
     * Flush the parser — attempt to parse any remaining valid content.
     * Call this when the stream ends, in case the last object was completed
     * without a trailing `]`.
     */
    flush = (): RawCommitMessage[] => {
        // Final feed with empty string to pick up any remaining complete objects
        return this.feed('');
    };

    /**
     * Get the accumulated buffer (for fallback full-text parsing).
     */
    getBuffer = (): string => {
        return this.buffer;
    };

    /**
     * Get the unparsed portion of the buffer — text after the last successfully
     * extracted object. This represents the "currently being generated" content.
     */
    getUnparsedBuffer = (): string => {
        return this.buffer.slice(this.scanPosition);
    };

    /**
     * Extract a balanced `{…}` block starting at the given index.
     * Returns the extracted string or null if the block is incomplete.
     * Handles nested braces, strings with escaped quotes, and special characters.
     */
    private extractBalancedBraces = (startIndex: number): string | null => {
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < this.buffer.length; i++) {
            const char = this.buffer[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    depth++;
                }
                if (char === '}') {
                    depth--;
                }

                if (depth === 0) {
                    return this.buffer.slice(startIndex, i + 1);
                }
            }
        }

        return null;
    };

    /**
     * Try to parse a JSON string as a RawCommitMessage.
     * Returns null if parsing fails or the object lacks a `subject` field.
     */
    private tryParseCommitMessage = (jsonString: string): RawCommitMessage | null => {
        try {
            const parsed = JSON.parse(jsonString) as Record<string, unknown>;
            if (typeof parsed.subject !== 'string') {
                return null;
            }
            return {
                subject: parsed.subject,
                body: typeof parsed.body === 'string' ? parsed.body : undefined,
                footer: typeof parsed.footer === 'string' ? parsed.footer : undefined,
            };
        } catch {
            return null;
        }
    };
}
