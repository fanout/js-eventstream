import Debug from 'debug';

type Listener = (e: any) => Promise<void> | void;

const debug = Debug('eventstream');

export default class AddressedEvents {
    private listeners: Listener[] = [];

    public addListener(fn: Listener) {
        this.listeners.push(fn);
        debug('AddressedEvents listener added, ' + this.listeners.length + ' listeners');

        return () => {
            this.listeners = this.listeners.filter((x) => x !== fn);
            debug('AddressedEvents listener removed, ' + this.listeners.length + ' listeners');
        };
    }

    public async addressedEvent(event: any) {
        debug('Calling addressedEvent with ' + this.listeners.length + ' listeners');
        for (const fn of this.listeners) {
            await fn(event);
        }
    }
}
