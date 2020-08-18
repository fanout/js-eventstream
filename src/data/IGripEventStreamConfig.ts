import { GripPublisherSpec } from './GripPublisherSpec';

export default interface IGripEventStreamConfig {
    prefix?: string,
    grip?: GripPublisherSpec,
}