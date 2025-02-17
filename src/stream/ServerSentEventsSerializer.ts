import { Transform } from 'stream';

import IServerSentEvent from '../data/IServerSentEvent.js';
import { encodeEvent } from '../utils/textEventStream.js';

import { KEEP_ALIVE_TIMEOUT } from '../constants.js';
import { NodeCallback } from '../utils/node.js';

export default class ServerSentEventsSerializer extends Transform {
    private keepAliveTimer: ReturnType<typeof setTimeout> | null;

    public constructor() {
        super({ writableObjectMode: true });
        this.keepAliveTimer = null;
        this.setupKeepAliveTimer();
    }

    public _transform(event: IServerSentEvent, _encoding: BufferEncoding, callback: NodeCallback) {
        try {
            this.setupKeepAliveTimer();
            const encodedEvent = encodeEvent({
                event: event.event,
                data: JSON.stringify(event.data),
            });
            this.push(encodedEvent);
        } catch (ex) {
            const err = ex instanceof Error ? ex : new Error(String(ex));
            callback(err);
            return;
        }
        callback();
    }

    private setupKeepAliveTimer() {
        if (this.keepAliveTimer != null) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        this.keepAliveTimer = setInterval(() => {
            const encodedEvent = encodeEvent({
                event: 'keep-alive',
                data: '',
            });
            this.push(encodedEvent);
        }, KEEP_ALIVE_TIMEOUT * 1000);
    }
}
