## connect-eventstream

Utility library to facilitate the creation of endpoints that implement the
[server-sent events (SSE)](https://en.wikipedia.org/wiki/Server-sent_events)
protocol to stream events to clients, provided as a `connect`-compatible middleware.

Sucn an endpoint can be consumed in web browsers using
[EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

Since this library is `connect`-compatible, it is usable with frameworks such as the following:

* [connect](https://github.com/senchalabs/Connect)
* [Express](https://expressjs.com/)
* [Next.js](https://nextjs.org/) *

Additionally, this library is [GRIP-aware](http://pushpin.org/docs/protocols/grip/) for scaling.
In fact, when running on serverless environments such as Next.js, you will almost always want
to use GRIP to hold the stream open while your application publishes to it in short-lived connections.

Supported GRIP servers include:

* [Pushpin](http://pushpin.org/)
* [Fanout Cloud](https://fanout.io/cloud/)

Author: Katsuyuki Ohmuro <kats@fanout.io>

Based on Previous work by Justin Karneges <justin@fanout.io>, Benjamin Goering <bengoering@gmail.com>
