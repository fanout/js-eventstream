import IServerSentEvent from "./data/IServerSentEvent";
import ConnectEventStream from "./ConnectEventStream";
import ChannelWritable from "./stream/ChannelWritable";

export default class ChannelPublisher {

    private readonly parent: ConnectEventStream;
    private readonly channel: string;

    public constructor(parent: ConnectEventStream, channel: string) {
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