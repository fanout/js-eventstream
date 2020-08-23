const express = require( 'express' );
const { EventStream } = require( '@fanoutio/eventstream' );

const PORT = 3000;
const CHANNEL_NAME = 'test';
const PUSHPIN_URL = "http://localhost:5561/";

const app = express();

const eventStream = new EventStream({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});

// localhost:3000/api/events (string passed in is the channel name)
app.get('/api/events', eventStream(CHANNEL_NAME));

// localhost:3000/api/events?ch=test (listens on 'get' because this evaluates to that)
app.get('/api/events/foo', eventStream(req => [req.method]));

// localhost:3000/api/events?ch=test (string is the query parameter name)
app.get('/api/events/:channelId', eventStream('{channelId}'));

app.post('/api/publish', async function(req, res) {

    const writer = eventStream.createChannelWritable(CHANNEL_NAME);
    writer.write({ event: 'message', 'data': { foo: 'bar' } });
    writer.end();

    res.end('Ok\n');

});

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
