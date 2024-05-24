export function genId(size: number): string {
    const chars: string[] = [];
    for (let n = 0; n < size; n++) chars.push(((16 * Math.random()) | 0).toString(16) as string);
    return chars.join('');
}
