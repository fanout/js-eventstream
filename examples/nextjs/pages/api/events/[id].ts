// localhost:7999/api/events/test (listens on 'test' because {id} is replaced by route parameter)
import { eventStream } from "../../../lib/eventStream";
export default eventStream('{id}');
