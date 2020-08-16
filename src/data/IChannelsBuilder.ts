import { IncomingMessage } from 'http';

export default interface IChannelsBuilder {
    (req: IncomingMessage): string | string[];
}
