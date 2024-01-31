export const createAsyncDelay = (duration: number) => {
    return new Promise<void>(resolve => setTimeout(() => resolve(), duration));
};
