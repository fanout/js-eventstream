import type { IncomingMessage } from 'node:http';

export default interface IChannelsBuilder {
    (req: IncomingMessage): string | string[];
}
