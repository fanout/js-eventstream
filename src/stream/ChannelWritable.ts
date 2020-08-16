import { Writable } from 'stream';
import Debug from 'debug';

import AddressedEvents from "../AddressedEvents";

import ConnectEventStream from '../ConnectEventStream';
import GripWritable from './GripWritable';
import IServerSentEvent from '../data/IServerSentEvent';

const debug = Debug('connect-eventstream');

export default class ChannelWritable extends Writable {

    private readonly gripWritable?: GripWritable;
    private readonly addressedEvents: AddressedEvents;
    private readonly channel: string;

    constructor(parent: ConnectEventStream, channel: string) {
        super({
            objectMode: true,
        });
        this.addressedEvents = parent.addressedEvents;
        this.channel = channel;

        if (parent.connectGrip != null) {
            this.gripWritable = new GripWritable(parent.connectGrip.getPublisher(), channel);
            this.gripWritable.on('grip:published', ({ event, channel }) => debug('published to gripPublisher', channel, event));

            // re-emit errors from 'channel' so user can respond to them
            // this.gripWritable.on('error', (error) => channel.emit('error', error))

            this.gripWritable.on('error', (_error) => {
                console.warn('Error publishing via GRIP. This happens. Giving up on this event.');
            });
        }
    }

    async _write(event: IServerSentEvent, _encoding: BufferEncoding, callback: Function) {
        debug("ChannelWritable.write");

        await this.addressedEvents.addressedEvent({ event, channel: this.channel });
        if (this.gripWritable == null) {
            callback();
            return;
        }

        // Give backpressure to anyone piping to this
        if (this.gripWritable.write(event, (error) => {
            if (error != null) {
                this.emit('grip:failedToPublish', { event, error });
            }
        })) {
            callback();
        } else {
            this.gripWritable.once('drain', () => callback());
        }
    }
}