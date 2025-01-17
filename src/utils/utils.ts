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

export const getFirstWordsFrom = (input: string, wordCount: number = 5): string => {
    const sanitizedInput = input.replace(/[\n\r]/g, '');
    const words = sanitizedInput.split(' ');
    const firstFiveWords = words.slice(0, wordCount);
    return firstFiveWords.join(' ');
};

export const stringToHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
};

export const hashToHSL = (hash: number) => {
    const hue = hash % 360;
    const saturation = 65 + (hash % 15);
    const lightness = 45 + (hash % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const hslToHex = (hslColor: any) => {
    // HSL 문자열에서 값 추출
    const [h, s, l] = hslColor.match(/\d+/g).map((n, i) => (i === 0 ? Number(n) : Number(n) / 100));

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r, g, b;
    if (h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const generateColors = (modelName: string) => {
    const hash = stringToHash(modelName);
    const primaryHSL = hashToHSL(hash);
    const primary = hslToHex(primaryHSL);

    return {
        primary: primary,
        secondary: '#FFFFFF',
    };
};
