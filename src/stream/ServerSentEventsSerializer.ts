import { Transform } from 'stream';

import IServerSentEvent from '../data/IServerSentEvent';
import { encodeEvent } from '../utils/textEventStream';

import { KEEP_ALIVE_TIMEOUT } from '../constants';

export default class ServerSentEventsSerializer extends Transform {
    private keepAliveTimer: ReturnType<typeof setTimeout> | null;

    public constructor () {
        super({ writableObjectMode: true });
        this.keepAliveTimer = null;
        this.setupKeepAliveTimer();
    }

    public _transform(event: IServerSentEvent, _encoding: BufferEncoding, callback: Function) {
        try {
            this.setupKeepAliveTimer();
            const encodedEvent = encodeEvent({
                event: event.event,
                data: JSON.stringify(event.data),
            });
            this.push(encodedEvent);
        } catch (error) {
            callback(error);
            return;
        }
        callback();
    }

    private setupKeepAliveTimer () {
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
        }, KEEP_ALIVE_TIMEOUT * 1000)
    }
}
