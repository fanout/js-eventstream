import { eventStream } from "../../lib/eventStream";

export default async (req, res) => {

    // Publish event directly
    await eventStream.publishEvent('test', { event: 'message', 'data': { name: 'John' } });

    // Get Publisher
    const publisher = eventStream.getChannelPublisher('test');
    await publisher.publishEvent({ event: 'message', 'data': { name: 'Alice' } });
    await publisher.publishEvent({ event: 'message', 'data': { name: 'Bob' } });

    // Use Writable
    const writable = publisher.createWritable();
    writable.write({ event: 'message', 'data': { baz: [ 'hi', 'ho', 'hello', ] } });
    writable.end();

    res.end('Ok\n');

};