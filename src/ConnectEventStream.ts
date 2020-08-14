import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse, } from 'http';

import accepts from 'accepts';
import CallableInstance from 'callable-instance';
import Debug from 'debug';

import { ConnectGrip, ConnectGripApiRequest, ConnectGripApiResponse, } from "@fanoutio/connect-grip";

import IHandlerOptions from './data/IHandlerOptions';
import IGripEventStreamConfig from './data/IGripEventStreamConfig';
import { GripPublisherSpec } from './data/GripPublisherSpec';

import ChannelWritable from './stream/ChannelWritable';
import ServerSentEventsSerializer from './stream/ServerSentEventsSerializer';
import AddressedEventsReadable from './stream/AddressedEventsReadable';

import { encodeEvent, joinEncodedEvents, } from './utils/textEventStream';
import { flattenHttpHeaders, } from './utils/http';
import { KEEP_ALIVE_TIMEOUT, } from './constants';

const debug = Debug('connect-eventstream');

type Handler = (req: IncomingMessage, res: ServerResponse, fn: Function) => void;
type AsyncHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

type EventStreamRequest = IncomingMessage & {
    eventStream?: IHandlerOptions,
};

export default class ConnectEventStream extends CallableInstance<[IncomingMessage, ServerResponse, Function], void> {

    connectGrip: ConnectGrip;

    prefix: string;
    addressedEvents: EventEmitter;

    _channelWritables: object = {};

    constructor(params: null | GripPublisherSpec | IGripEventStreamConfig) {
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

        let gripPublisher = null;
        if (gripParam != null) {
            debug("Initializing ConnectGrip with grip", gripParam);
            debug("Initializing ConnectGrip with prefix", prefix);
            this.connectGrip = new ConnectGrip({
                grip: gripParam,
                prefix,
            });
        }

        if (!this.connectGrip) {
            debug('Events will not publish to grip because no gripPublisher', gripPublisher);
        }
        this.prefix = prefix;

        // all events written to all channels as { channel, event } objects
        this.addressedEvents = new EventEmitter();
        this.addressedEvents.on('addressedEvent', e => debug('connect-eventstream event', e));
    }

    getChannelWritable(channel: string) {
        if (this._channelWritables[channel] == null) {
            this._channelWritables[channel] = new ChannelWritable(this, channel);
        }
        return this._channelWritables[channel];
    }

    createAsyncHandler(options?: IHandlerOptions): AsyncHandler;
    createAsyncHandler(channels: string[]): AsyncHandler;
    createAsyncHandler(...channels: string[]): AsyncHandler;
    createAsyncHandler(...params: any[]): AsyncHandler {
        debug("Creating Async Handler");
        const options = this.parseParams(...params);
        return async (req: ConnectGripApiRequest, res: ConnectGripApiResponse) => {
            debug("Async Handler Running");
            await this.run(req, res, options);
        };
    }

    parseParams(options: IHandlerOptions): IHandlerOptions;
    parseParams(channels: string[]): IHandlerOptions;
    parseParams(...channels: string[]): IHandlerOptions;
    parseParams(...params: any[]): IHandlerOptions {

        debug("Parsing options");
        let options: IHandlerOptions;

        let channels: null | string[] = null;
        if (params.length === 0) {
            debug("No parameters given");
            channels = [];
        } else if (typeof params[0] === 'string') {
            debug("First parameter is a string, treating all parameters as channels");
            channels = params.filter(x => typeof x === 'string');
        } else if (Array.isArray(params[0])) {
            debug("First parameter is an array, treating as array of channels");
            channels = params[0].filter(x => typeof x === 'string');
        }

        if (channels != null) {
            debug("Parsed channel names", channels);
            options = {
                channels,
            };
        } else {
            debug("Treating parameter as options object");
            options = params[0];
        }

        return options;
    }

    route(options: IHandlerOptions): Handler;
    route(channels: string[]): Handler;
    route(...channels: string[]): Handler;
    route(req: IncomingMessage, res: ServerResponse, fn: Function): void;
    route(req: IncomingMessage, res: ServerResponse): Promise<void>;
    route(...params: any[]): void | Handler | Promise<void> {

        if (params[0] != null && params[0] instanceof IncomingMessage) {

            if (params.length === 3) {

                debug("Called with 3 parameters, running as Connect middleware with default values.");

                const [ req, res, fn ] = params;
                this.exec(req, res, fn);

            } else if (params.length === 2) {

                // This object is being called directly as a Nextjs handler
                // that uses default values

                debug("Called with 2 parameters, running as async handler with default values.");
                const [ req, res ] = params;
                return this.run(req as ConnectGripApiRequest, res as ConnectGripApiResponse);

            }

        } else {

            debug("Called with configuration data, configuring and returning Connect middleware.");
            const options = this.parseParams(...params);

            return (req: IncomingMessage, res: ServerResponse, fn: Function) => {
                const eventStreamRequest = req as EventStreamRequest;
                eventStreamRequest.eventStream = options;
                this.exec(eventStreamRequest, res, fn);
            };

        }

    }

    exec(req: IncomingMessage, res: ServerResponse, fn: Function) {
        let err: Error | undefined;
        this.run(req as ConnectGripApiRequest, res as ConnectGripApiResponse, (req as EventStreamRequest).eventStream)
            .catch(ex => err = ex)
            .then(() => {
                if (err !== undefined) {
                    fn(err);
                } else {
                    fn();
                }
            });
    }

    async run(req: ConnectGripApiRequest, res: ConnectGripApiResponse, eventStreamOptions?: IHandlerOptions) {

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

        const channels = eventStreamOptions?.channels?.slice() ?? [];
        const readChannelsFromQuery = eventStreamOptions?.channelsFromQuery ?? false;
        const channelParamName = typeof readChannelsFromQuery === 'string' ? readChannelsFromQuery : 'channel';
        if (channels.length === 0 || readChannelsFromQuery !== false) {
            debug("Getting channels from query parameter", channelParamName);
            const parsedUrl = new URL(req.url!, `http://${req.headers['host']}`);
            const queryParams = parsedUrl.searchParams.getAll(channelParamName);
            for (const value of queryParams) {
                if (!channels.includes(value)) {
                    channels.push(value);
                }
            }
        }

        if (channels.length === 0) {
            debug("No specified channels.");
            res.statusCode = 400;
            let message = `No specified channels.`;
            if (readChannelsFromQuery !== false) {
                message += ' Specify the channels to read from using the ?' + readChannelsFromQuery + ' query parameter.';
            }
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