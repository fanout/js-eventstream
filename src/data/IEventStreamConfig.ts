import { GripPublisherSpec } from './GripPublisherSpec';

export default interface IEventStreamConfig {
    grip?: GripPublisherSpec;
    gripPrefix?: string;
}
