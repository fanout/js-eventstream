/**
 * tools for encoding objects to text/event-stream strings
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */

const COMMENT_PREFIX = ':';
const NEWLINE = '\n';

/**
 * encode an event
 * @param fields - Fields to encode into the event, e.g. { data: 'foo' }
 * @param comments - Any comments to encode into event. They will be ignored by most clients.
 * Comments are printed before fields
 * @returns text/event-stream encoded event
 */
export function encodeEvent(fields?: object, comments?: string | string[]): string {
    let event = '';
    if (comments != null) {
        if (!Array.isArray(comments)) {
            comments = [comments];
        }
        for (const comment of comments) {
            event += COMMENT_PREFIX + comment + NEWLINE;
        }
    }
    if (fields != null) {
        for (const [field, value] of Object.entries(fields)) {
            const segments = String(value).split(NEWLINE);
            for (const segment of segments) {
                event += field + ': ' + segment + NEWLINE;
            }
        }
    }
    event += NEWLINE;
    return event;
}

export function joinEncodedEvents(encodedEvents: string | string[]): string {
    encodedEvents = !Array.isArray(encodedEvents) ? [encodedEvents] : encodedEvents;
    return encodedEvents.join('\n\n');
}
