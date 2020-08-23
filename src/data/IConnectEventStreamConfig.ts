import { GripPublisherSpec } from './GripPublisherSpec';

export default interface IConnectEventStreamConfig {
    grip?: GripPublisherSpec;
    gripPrefix?: string;
}
