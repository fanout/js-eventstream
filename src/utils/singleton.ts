import EventStream from '../EventStream';
import IEventStreamConfig from '../data/IEventStreamConfig';

const processLocalValues = {};
function getDevProcessSingleton(key: string, factory: () => object) {
    let dict;
    if (process.env.NODE_ENV !== 'production') {
        const proc = process as any;
        if (proc.devSingletons == null) {
            proc.devSingletons = {};
        }
        dict = proc.devSingletons;
    } else {
        dict = processLocalValues;
    }
    if (dict[key] == null) {
        dict[key] = factory();
    }
    return dict[key];
}

export function getEventStreamSingleton(params: IEventStreamConfig | null, singletonKey: string = 'eventStream') {
    return getDevProcessSingleton(singletonKey, () => {
        return new EventStream(params);
    });
}
