// localhost:7999/api/events-foo (listens on 'GET' because that's the return value of the function)
import { eventStream } from "../../lib/eventStream";
export default eventStream(req => req.method);
