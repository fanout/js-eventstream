import IServerSentEvent from './IServerSentEvent';

export default interface IAddressedEvent {
    channel: string;
    event: IServerSentEvent;
}
