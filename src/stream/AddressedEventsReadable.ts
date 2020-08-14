import { EventEmitter } from 'events';
import { Readable } from 'stream';

import Debug from 'debug';

import IAddressedEvent from '../data/IAddressedEvent';

const debug = Debug('connect-eventstream');

export default class AddressedEventsReadable extends Readable {
    private readonly addressedEvents: EventEmitter;
    private readonly channels: string[];
    private listenHandle: (() => void) | null;

    constructor(addressedEvents: EventEmitter, channels: string[]) {
        super({
            objectMode: true,
        });

        this.addressedEvents = addressedEvents;
        debug('AddressedEventsReadable constructed with channels', channels);
        this.channels = channels;
    }

    _read(_size: number) {
        debug('AddressedEventsReadable _read');
        if (this.listenHandle == null) {
            debug('AddressedEventsReadable setting up listener');
            const listener = (addressedEvent: IAddressedEvent) => {
                if (this.channels.includes(addressedEvent.channel)) {
                    this.push(addressedEvent.event);
                }
            };
            this.addressedEvents.on('addressedEvent', listener);
            this.listenHandle = () => {
                debug('AddressedEventsReadable removing listener');
                this.addressedEvents.removeListener('addressedEvent', listener);
            };
        }
    }

    _destroy(error: Error | null, callback: (error?: (Error | null)) => void) {
        debug('AddressedEventsReadable _destroy');
        if (this.listenHandle != null) {
            this.listenHandle();
            this.listenHandle = null;
        }
        super._destroy(error, callback);
    }

}
