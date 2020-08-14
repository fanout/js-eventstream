import { Writable } from 'stream';

import { Publisher } from '@fanoutio/grip';

import IServerSentEvent from '../data/IServerSentEvent';
import { encodeEvent } from '../utils/textEventStream';

/**
 * Writable stream that publishes written events to a Grip Control Publish endpoint
 */
export default class GripWritable extends Writable {

    gripPublisher: Publisher;
    channel: string;

    constructor (gripPublisher: Publisher, channel: string) {
        super({
            objectMode: true,
        });
        this.gripPublisher = gripPublisher;
        this.channel = channel;
    }

    _write(event: IServerSentEvent, _encoding: BufferEncoding, callback: Function) {
        const encodedEvent = encodeEvent({
            event: event.event,
            data: JSON.stringify(event.data),
        });

        // TODO: Add retries

        (async () => {
            try {
                await this.gripPublisher.publishHttpStream(this.channel, encodedEvent);
                this.emit('grip:published', { event, channel: this.channel });
            } catch(ex) {
                callback(ex);
                return;
            }
            callback();
        })();
    }
}
