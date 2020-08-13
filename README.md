## nextjs-eventstream

Utility library to facilitate the creation of endpoints that stream events to clients, for Next.js.

* [Next.js](https://nextjs.org/)

These endpoints implement [server-sent events (SSE)](https://en.wikipedia.org/wiki/Server-sent_events),
so they can be consumed in web browsers using [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

The library is [GRIP-aware](http://pushpin.org/docs/protocols/grip/) for scaling.

Supported GRIP servers include:

* [Pushpin](http://pushpin.org/)
* [Fanout Cloud](https://fanout.io/cloud/)

Author: Katsuyuki Ohmuro <kats@fanout.io>
