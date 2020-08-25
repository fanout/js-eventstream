# EventStream

This is a library for making endpoints that implement the [server-sent events (SSE)](https://en.wikipedia.org/wiki/Server-sent_events) protocol to push events to clients, provided as a `connect`-compatible middleware.

Such endpoints can be consumed in web browsers using [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

Since this library is `connect`-compatible, it is usable with frameworks such as the following:

* [connect](https://github.com/senchalabs/Connect)
* [Express](https://expressjs.com/)
* [Next.js](https://nextjs.org/)

Additionally, this library is [GRIP-aware](#multiple-instances-and-serverless), for scaling to multiple instances or running in serverless environments.

### Initializing

Construct a `EventStream` object:

```javascript
import { EventStream } from "@fanoutio/eventstream";

const eventStream = new EventStream();
```

You need to create this object once as a singleton and then refer to it from all routes, as events sent over the publisher will only be seen by requests listening on the same instance. This also means that if your application has several processes running, published events will only go to HTTP Connections on the process that publishes the message.

To scale to more than one web server process, you'll need to use [a GRIP proxy](#multiple-instances-and-serverless), and make sure you publish each event from one place.

## To use in Express:

### Add Routes

Add routes, and use `eventStream` to create handlers. For this you have two options:

1. Call `eventStream` as a function, and pass in a string or array of strings. These strings will be used as the names of the channel(s) to listen to. Any tokens in the channel names delimited by `{` and `}` will be replaced by their corresponding values from route parameters.

```javascript
import { EventStream } from "@fanoutio/eventstream";

export const CHANNEL_NAME = 'test';
const eventStream = new EventStream();

// /api/events (listens on 'test' because it is literal string passed in)
app.get('/api/events', eventStream(CHANNEL_NAME));

// /api/events/test (listens on 'test' because {id} is replaced by route parameter)
app.get('/api/events/:id', eventStream('{id}'));
```

2. (advanced) Call `eventStream` as a function, and pass in a function that takes a `request` object and returns a string or an array of strings. These strings will be used as the names of the channels to listen to.

### Publish Events

See the [Publishing Events](#publishing-events) section below.

## To use in Next.js:

Next.js's development server continuously monitors and rebuilds files. Each time this happens, your singleton instance of EventStream will be recreated and previous instances will become unreachable.

To keep the singleton accessible, use the `getEventStreamSingleton` function exported from this package. This function takes an object as an argument, and this is the same object that you would pass to the constructor of `EventStream`.

### Add Routes

Add API routes to your to Next.js application in the standard way, to handle requests to serve event streams. From these API routes, call `eventStream` in the same way as in Express and then export them as the default export from your route files.

1. Call `eventStream` and pass in a string or array of strings.

File /lib/eventStream.js:

```javascript
import { getEventStreamSingleton } from "@fanoutio/eventstream";

export const CHANNEL_NAME = 'test';
export const eventStream = getEventStreamSingleton();
```

File /api/events.js:

```javascript
import { eventStream, CHANNEL_NAME } from "../../lib/eventStream";

// /api/events (listens on 'test' because it is literal string passed in)
export default eventStream(CHANNEL_NAME);
```

File /api/events/[id].js:

```javascript
import { eventStream } from "../../lib/eventStream";

// /api/events/test (listens on 'test' because {id} is replaced by route parameter)
export default eventStream('{id}');
```

2. (advanced) Call `eventStream` and pass in a function that returns a string or an
array of strings.

### Publish Events

See the [Publishing Events](#publishing-events) section below.

## Publishing Events

To publish, call `eventStream.publishEvent(channel, { event, data })`. `event` is the string name and `data` is a JavaScript object that represents the Server-Sent Event. This is an `async` function, so you may `await` it if you wish to block until the event has sent. Notably, if GRIP is being used, this will block until GRIP publish has completed.

```javascript
await eventStream.publishEvent(CHANNEL_NAME, { event: 'message', 'data': { name: 'John' } });
```

Alternatively, if you will be sending many events to the same channel, you can get a `ChannelPublisher` by calling `eventStream.getChannelPublisher(channel)`. Then you can call `publishEvent({ event, data })` on the returned object.

```javascript
const publisher = eventStream.getChannelPublisher('test');
await publisher.publishEvent({ event: 'message', 'data': { name: 'Alice' } });
await publisher.publishEvent({ event: 'message', 'data': { name: 'Bob' } });
```

If you wish to pipe a stream, you can call `eventStream.createChannelWritable(channel)` and pass the name of a channel. This will return a `stream.Writeable` object whose `write()` method can be used to emit objects to clients listening to the appropriate channels from the event streams endpoints created above.

```javascript
const writable = eventStream.createChannelWritable('test'); // or publisher.createWritable()
writable.write({ event: 'message', 'data': { baz: [ 'hi', 'ho', 'hello', ] } });
writable.end();
```

There will be appropriate backpressure on this `Writeable` so that writing goes only as fast as events can be dispatched, which is especially important when publishing through GRIP.

## Multiple instances and serverless

If you need to run multiple instances of the server for high availability or scale, or need to run the server in a serverless/function-as-a-service environment, you can introduce a [GRIP proxy layer](http://pushpin.org/docs/protocols/grip/) into your architecture.

Supported GRIP proxies include:

* [Pushpin](https://pushpin.org/)
* [Fanout Cloud](https://fanout.io/cloud/)

To use GRIP, construct the `EventStream` object with your proxy settings. The object's constructor takes an optional object that has `grip` and `gripPrefix`.

`grip` is optional and can be any of the following:

1. `null`. This is the default, and GRIP will not be used.
2. a string. This will be parsed using `parseGripUri`.  The common use case would be to pass in `process.env.GRIP_URL`.
3. an object that has `control_uri`, `control_iss`, and `key`, used to initialize a GRIP publisher.
4. an array of objects described in 3.
5. an instantiated `Publisher` object from `@fanoutio/grip`. Publishing through `eventstream` will then end up
publishing to all channels on that `Publisher` object.

`gripPrefix` is optional and defaults to `'events-'` if not specified. This can be used to
namespace GRIP events.

Example using configuration from the `GRIP_URL` environment variable:

```javascript
import { EventStream } from "@fanoutio/eventstream";

const eventStream = new EventStream({grip:process.env.GRIP_URL});
```

Then configure your GRIP proxy to forward traffic to your server. For example, with Fanout Cloud, set the host:port of your deployed server as your realm's Origin Server, and have clients connect to your realm domain.

## Advanced Usage

### Direct invocation

If you wish to run `eventstream`'s functionality directly, for example in a conditional way, you may call `eventStream.run(req, res, channels)`.

```javascript
app.get('/', async (req, res, next) => {
    // Only do eventStream if header 'foo' has value 'bar' 
    if (req.headers['foo'] === 'bar') {
        try {
            await eventStream.run(req, res, ['test']);
        } catch(ex) {
            next(ex instanceof Error ? ex : new Error(ex));
        }
    } else {
        next();
    }
});
```

### Multiple singletons

`getEventStreamSingleton` takes an optional second parameter. There may be advanced scenarios where you need more than one instance of `EventStream`. In such a case you can use this second parameter to identify each instance.

```javascript
import { getEventStreamSingleton } from "@fanoutio/eventstream";

const eventStream1 = new getEventStreamSingleton({}, "eventStream1");
const eventStream2 = new getEventStreamSingleton({}, "eventStream2");
```

### Contributors

Author: Katsuyuki Ohmuro <kats@fanout.io>

Based on previous work by Justin Karneges <justin@fanout.io> and Benjamin Goering <bengoering@gmail.com>.
