// This section is written according to Wikipedia description of the UTF-8 encoding:
// https://en.wikipedia.org/wiki/UTF-8#Description

export function fromUtf8CharArray(arr: Uint8Array): string {
    let unicodePoints: number[] = [];
    let top: number = 0;
    let padding: number = 0; 
    let rank: number = 0;
    const replacementCharacter : number = 0xfffd;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] <= 0b0111_1111) {
            if (rank > 0) {
                unicodePoints.push(replacementCharacter);
            }
            unicodePoints.push(arr[i]);
        } else if (arr[i] <= 0b1011_1111) { 
            if (rank === 0) {
                unicodePoints.push(padding + top);
            } else {
                top *= 64;
                top += arr[i] % 64;
                rank--;
            }
        } else if (arr[i] <= 0b1101_1111) {
            if (rank > 0 || arr[i] <= 0xC1) {
                unicodePoints.push(replacementCharacter);
            }
            padding = 0x80;
            rank = 1;
            top = arr[i] % 32;
        } else if (arr[i] <= 0b1110_1111) {
            if (rank > 0) {
                unicodePoints.push(replacementCharacter);
            }
            padding = 0x800;
            rank = 2;
            top = arr[i] % 16;
        } else if (arr[i] <= 0b1111_0011) {
            if (rank > 0) {
                unicodePoints.push(replacementCharacter);
            }
            padding = 0x10000;
            rank = 3;
            top = arr[i] % 16;
        } else {
            unicodePoints.push(replacementCharacter);
        }
    }
    return unicodePoints.map((x) => String.fromCodePoint(x)).join("");
}

export function toUtf8CharArray(str: string): Uint8Array {
    let array = new Array<number>();
    
    for (const codePointStr of str) {
        let codePoint = codePointStr.codePointAt(0) as number;
        if (codePoint <= 0b0111_1111) {
            array.push(codePoint)
        } else if (codePoint <= 0b0000_0111_1111_1111) {
            array.push(0b1100_0000 + (codePoint >> 6));
            codePoint -= (codePoint >> 6) << 6;
            array.push(0b1000_0000 + codePoint);
        } else if (codePoint <= 0b1111_1111_1111_1111) {
            array.push(0b1110_0000 + (codePoint >> 12));
            codePoint -= (codePoint >> 12) << 12;
            array.push(0b1000_0000 + (codePoint >> 6));
            codePoint -= (codePoint >> 6) << 6;
            array.push(0b1000_0000 + codePoint);
        } else if (codePoint <= 0b0001_0000_1111_1111_1111_1111) {
            // While by bitwise logic characters could extend to 0x1fffff,
            // the Unicode standard forbids characters above 0x10ffff,
            // thus the UTF-8 sequence of the maximum possible character is
            // 0b1111_0100_1000_1111_1011_1111_1011_1111_1011_1111
            // (0x74_8f_bf_bf).
            array.push(0b1111_0000 + (codePoint >> 18));
            codePoint -= (codePoint >> 18) << 18;
            array.push(0b1000_0000 + (codePoint >> 12));
            codePoint -= (codePoint >> 12) << 12;
            array.push(0b1000_0000 + (codePoint >> 6));
            codePoint -= (codePoint >> 6) << 6;
            array.push(0b1000_0000 + codePoint);
        } else {
            throw new Error("Error encoding Javascript string to an UTF-8 sequence");
        }
    }
    return new Uint8Array(array.flat());
}
