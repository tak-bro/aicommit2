import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

export const createAsyncDelay = (duration: number) => {
    return new Promise<void>(resolve => setTimeout(() => resolve(), duration));
};

export const capitalizeFirstLetter = (text: string) => (text ? `${text[0].toUpperCase()}${text.slice(1)}` : text);

export const getRandomNumber = (min: number, max: number): number => {
    const minValue = Math.ceil(min);
    const maxValue = Math.floor(max);
    return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
};

export async function* toObservable<T>(promiseAsyncGenerator: Promise<AsyncGenerator<T>>): AsyncGenerator<T> {
    const asyncGenerator = await promiseAsyncGenerator;
    for await (const value of asyncGenerator) {
        yield value;
    }
}

export const truncateString = (str: string, maxLength: number) => {
    if (str.length > maxLength) {
        return str.slice(0, maxLength);
    } else {
        return str;
    }
};

export const sortByDisabled = (a: ReactiveListChoice, b: ReactiveListChoice) => {
    if (a.disabled && !b.disabled) {
        return 1;
    }
    if (!a.disabled && b.disabled) {
        return -1;
    }
    return 0;
};

export const DONE = `done`;
export const UNDONE = `undone`;

export const removeTextAfterPhrase = (text: string, phrase: string, includePhrase: boolean = false) => {
    const index = text.indexOf(phrase);
    if (index !== -1) {
        const extraIndex = includePhrase ? phrase.length : 0;
        return text.slice(0, index + extraIndex).trim();
    }
    return text;
};

export const flattenDeep = <T>(arr: any[]): T[] => {
    return arr.reduce((acc: T[], val: any) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)), []);
};
