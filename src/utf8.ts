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
    return String.fromCodePoint(...unicodePoints);
}
