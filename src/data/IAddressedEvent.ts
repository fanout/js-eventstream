import IServerSentEvent from './IServerSentEvent.js';

export default interface IAddressedEvent {
    channel: string;
    event: IServerSentEvent;
}
