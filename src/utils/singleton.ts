import ConnectEventStream from '../ConnectEventStream';
import IConnectEventStreamConfig from '../data/IConnectEventStreamConfig';

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

export function getConnectEventStreamSingleton(
    params: IConnectEventStreamConfig | null,
    singletonKey: string = 'connectEventStream',
) {
    return getDevProcessSingleton(singletonKey, () => {
        return new ConnectEventStream(params);
    });
}
