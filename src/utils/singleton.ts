const singletons = {};
export function getProcessSingletons(): { [key: string]: any } {
    let dict;
    if (process.env.NODE_ENV !== 'production') {
        const proc = process as any;
        if (proc.devSingletons == null) {
            proc.devSingletons = {};
        }
        dict = proc.devSingletons;
    } else {
        dict = singletons;
    }
    return dict;
}

export function getProcessSingleton(key: string, fn: () => any): any {
    const dict = getProcessSingletons();
    if (!(key in dict)) {
        dict[key] = fn();
    }
    return dict[key];
}
