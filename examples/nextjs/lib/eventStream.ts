import { getEventStreamSingleton } from "@fanoutio/eventstream";

const PUSHPIN_URL = "http://localhost:5561/";
export const CHANNEL_NAME = 'test';

export const eventStream = getEventStreamSingleton({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});
