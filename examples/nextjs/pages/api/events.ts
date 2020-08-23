// localhost:7999/api/events (listens on 'test' because it is literal string passed in)
import { eventStream, CHANNEL_NAME } from "../../lib/eventStream";
export default eventStream(CHANNEL_NAME);
