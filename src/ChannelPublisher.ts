import IServerSentEvent from './data/IServerSentEvent.js';
import EventStream from './EventStream.js';
import ChannelWritable from './stream/ChannelWritable.js';

export default class ChannelPublisher {
    private readonly parent: EventStream;
    private readonly channel: string;

    public constructor(parent: EventStream, channel: string) {
        this.parent = parent;
        this.channel = channel;
    }

    public async publishEvent(event: IServerSentEvent) {
        await this.parent.publishEvent(this.channel, event);
    }

    public createWritable() {
        return new ChannelWritable(this);
    }
}
