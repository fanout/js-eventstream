import { IncomingMessage, ServerResponse, } from 'http';

import accepts from 'accepts';
import CallableInstance from 'callable-instance';
import Debug from 'debug';

import { ConnectGrip, ConnectGripApiRequest, ConnectGripApiResponse, } from "@fanoutio/connect-grip";

import IChannelsBuilder from "./data/IChannelsBuilder";
import IGripEventStreamConfig from './data/IGripEventStreamConfig';
import { GripPublisherSpec } from './data/GripPublisherSpec';

import IServerSentEvent from "./data/IServerSentEvent";
import AddressedEvents from "./AddressedEvents";

import ChannelPublisher from './ChannelPublisher';
import ServerSentEventsSerializer from './stream/ServerSentEventsSerializer';
import AddressedEventsReadable from './stream/AddressedEventsReadable';

import { encodeEvent, joinEncodedEvents, } from './utils/textEventStream';
import { flattenHttpHeaders, } from './utils/http';
import { KEEP_ALIVE_TIMEOUT, } from './constants';

const debug = Debug('connect-eventstream');

export default class ConnectEventStream extends CallableInstance<[IncomingMessage, ServerResponse, Function], void> {

    private readonly addressedEvents: AddressedEvents;
    private readonly channelPublishers: { [channel: string] : ChannelPublisher; } = {};
    private readonly connectGrip: ConnectGrip;

    public constructor(params: null | GripPublisherSpec | IGripEventStreamConfig) {
        super('route');

        let gripParam: GripPublisherSpec;
        let prefix: string | null;

        const paramsAsAny = params as any;
        if (paramsAsAny?.grip != null) {
            gripParam = paramsAsAny.grip;
            prefix = paramsAsAny.prefix;
        } else {
            gripParam = paramsAsAny;
            prefix = null;
        }
        prefix = prefix ?? 'events-';

        if (gripParam != null) {
            debug("Initializing ConnectGrip with grip", gripParam);
            debug("Initializing ConnectGrip with prefix", prefix);
            this.connectGrip = new ConnectGrip({
                grip: gripParam,
                prefix,
            });
        }

        // all events written to all channels as { channel, event } objects
        this.addressedEvents = new AddressedEvents();
        this.addressedEvents.addListener(e => debug('connect-eventstream event', e));

        if (this.connectGrip != null) {
            const publisher = this.connectGrip.getPublisher();
            this.addressedEvents.addListener(async ({ channel, event, }) => {
                const encodedEvent = encodeEvent({
                    event: event.event,
                    data: JSON.stringify(event.data),
                });
                debug("grip:publishing", { channel, event });
                await publisher.publishHttpStream(channel, encodedEvent);
                debug("grip:published", { channel, event });
            });
        } else {
            debug('Events will not publish to GRIP because no gripPublisher');
        }
    }

    public async publishEvent(channel: string, event: IServerSentEvent) {
        await this.addressedEvents.addressedEvent({ event, channel, });
    }

    public getChannelPublisher(channel: string) {
        if (this.channelPublishers[channel] == null) {
            this.channelPublishers[channel] = new ChannelPublisher(this, channel);
        }
        return this.channelPublishers[channel];
    }

    public createChannelWritable(channel: string) {
        return this.getChannelPublisher(channel).createWritable();
    }

    private buildChannels(req: IncomingMessage, channels: string[]): string[] {

        const regex = /(?:{([_A-Za-z][_A-Za-z0-9]*)})/g;

        // In Express, req will have a params property that matches the pieces of the URL
        // e.g., path: /api/channel-:channelId
        // Request URL: /api/channel-test
        // req.params: { "channelId": "test" }

        // In Next.js, req will have a query property that matches a route segment.
        // (Unlike Express, the dynamic part needs to be an entire segment.)
        // e.g, path: /api/channel/[channelId].ts
        // Request URL: /api/channel/test
        // req.query: { "channelId": "test" }

        let paramsObj: object | null = null;

        const reqAsAny = req as any;
        if (reqAsAny.params != null) {
            // Note: Express's req also has a req.query that matches the query params from the
            // search part of the URL.  For this reason we test for Express first
            paramsObj = reqAsAny.params;
        } else if (reqAsAny.query != null) {
            paramsObj = reqAsAny.query;
        }

        return channels.map(ch => ch.replace(regex, (_substring, token1) => {
            return paramsObj?.[token1] ?? '';
        }));

    }

    public route(...channelNames: string[]): Function;
    public route(channelNames: string[]): Function;
    public route(channelBuilder: IChannelsBuilder): Function;
    public route(...params: any[]): Function {

        let channelsBuilder: IChannelsBuilder;

        if (params.length === 0) {
            throw new Error('connectEventStream must be called with at least one parameter.');
        }

        if (typeof params[0] === 'function') {
            debug("Treating parameter as channel builder function");
            channelsBuilder = params[0];
        } else {
            // Channel names is
            let channelNames: string[];

            if (Array.isArray(params[0])) {
                debug("Parameter is array, treating as list of channel names");
                channelNames = params[0];
            } else {
                debug("Parameters are spread, treating as list of channel names");
                channelNames = params;
            }
            channelsBuilder = (req) => this.buildChannels(req, channelNames);
        }

        debug("Called with configuration data, configuring and returning Connect middleware.");

        return async (req: IncomingMessage, res: ServerResponse, fn: Function): Promise<void> => {

            const useFnForError = fn != null;
            if (useFnForError) {
                debug("Called with 3 params, will call fn(error) to handle errors.");
            } else {
                debug("Called with 2 params, will throw async exception to handle errors.");
            }

            try {
                await this.run(req as ConnectGripApiRequest, res as ConnectGripApiResponse, channelsBuilder);
            } catch(ex) {
                ex = ex instanceof Error ? ex : new Error(ex);
                if (useFnForError) {
                    fn(ex);
                } else {
                    throw ex;
                }
            }

        };

    }

    private async run(req: ConnectGripApiRequest, res: ConnectGripApiResponse, channelsBuilder: IChannelsBuilder) {

        debug("Beginning NextjsEventStream.run");

        const accept = accepts(req);
        const types = accept.types('text/event-stream');
        if (!types) {
            debug("Type not accepted by client");
            res.statusCode = 406;
            res.end('Not Acceptable.\n');
            return;
        }
        debug("Type accepted by client");

        // Run ConnectGrip if it hasn't been run yet.
        if (req.grip == null) {
            debug("Running ConnectGrip");
            await this.connectGrip.run(req, res);
        }

        const grip = req.grip;
        if (grip.isProxied) {
            debug("This is a GRIP-proxied request");
            if (grip.needsSigned && !grip.isSigned) {
                req.statusCode = 403;
                res.end('GRIP Signature Invalid.\n');
                return;
            }
        }
        if (grip.isSigned) {
            debug("This is a GRIP-signed request");
        }

        const lastEventId = flattenHttpHeaders(req.headers['last-event-id']);
        if (lastEventId === 'error') {
            res.statusCode = 400;
            res.end(`last-event-id header may not be 'error'.\n`);
            return;
        }
        debug("'last-event-id' header value is", lastEventId);

        const channelsBuilderResult = channelsBuilder(req);
        const channels = Array.isArray(channelsBuilderResult) ? channelsBuilderResult : [ channelsBuilderResult ];

        if (channels.length === 0) {
            debug("No specified channels.");
            res.statusCode = 400;
            let message = `No specified channels.`;
            res.end(`${message}\n`);
            return;
        }

        debug("Listening for events on channels", channels);

        res.statusCode = 200;

        const events = [
            encodeEvent({
                event: 'stream-open',
                data: ''
            }),
        ];
        debug("Added stream-open event");

        if (grip.isProxied) {
            // Use a GRIP hold to keep a stream going
            const gripInstruct = res.grip.startInstruct();
            gripInstruct.setHoldStream();
            gripInstruct.addChannel(channels);
            const keepAliveValue = encodeEvent({
                event: 'keep-alive',
                data: '',
            });
            gripInstruct.setKeepAlive(keepAliveValue, KEEP_ALIVE_TIMEOUT);
            debug("GRIP Instruction Headers", gripInstruct.toHeaders());
        } else {
            debug("Performing SSE over chunked HTTP");
            res.setHeader('Connection', 'Transfer-Encoding');
            res.setHeader('Transfer-Encoding', 'chunked');
        }

        res.write(joinEncodedEvents(events));

        if (grip.isProxied) {
            debug('Exiting. Future events will be delivered via GRIP publishing.');
            res.end();
            return
        }

        debug('Starting subscription and piping from Addressed Events.');
        debug('Future events will be delivered via piping to response.');
        new AddressedEventsReadable(this.addressedEvents, channels)
            .pipe(new ServerSentEventsSerializer())
            .pipe(res)
            .on('finish', () => debug('Response finish (no more writes)'))
            .on('close', () => debug('Response close'));
    }
}