import { GripPublisherSpec } from './GripPublisherSpec.js';

export default interface IEventStreamConfig {
    grip?: GripPublisherSpec;
    gripPrefix?: string;
}
