import { Writable } from 'stream';
import Debug from 'debug';

import ChannelPublisher from '../ChannelPublisher.js';
import IServerSentEvent from '../data/IServerSentEvent.js';
import { NodeCallback } from '../utils/node.js';

const debug = Debug('eventstream');

export default class ChannelWritable extends Writable {
    private readonly channelPublisher: ChannelPublisher;

    public constructor(channelPublisher: ChannelPublisher) {
        super({
            objectMode: true,
        });
        this.channelPublisher = channelPublisher;
    }

    public async _write(event: IServerSentEvent, _encoding: BufferEncoding, callback: NodeCallback) {
        let err: Error | undefined;
        try {
            debug('ChannelWritable.write');

            await this.channelPublisher.publishEvent(event);
        } catch (ex) {
            err = ex instanceof Error ? ex : new Error(String(ex));
        }

        // The above is an async method that doesn't return until the publish has finished
        // (if GRIP is enabled then it won't return until GRIP publish has finished)
        // For this reason this should apply backpressure to the writing.

        if (err != null) {
            callback(err);
        } else {
            callback();
        }
    }
}
