import { GripPublisherSpec } from './GripPublisherSpec';

export default interface IGripEventStreamConfig {
    grip?: GripPublisherSpec,
    gripPrefix?: string,
}