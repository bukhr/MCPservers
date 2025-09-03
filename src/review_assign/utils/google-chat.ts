export const extractThreadNameFromUrl = (url?: string): string | null => {
    if (!url) return null;
    const roomIdx = url.indexOf('/room/');
    if (roomIdx !== -1) {
        const afterRoom = url.substring(roomIdx + '/room/'.length);
        const q = afterRoom.indexOf('?');
        const h = afterRoom.indexOf('#');
        const cutIdx = [q, h].filter(v => v !== -1).reduce((min, v) => Math.min(min, v), Infinity);
        const clean = isFinite(cutIdx) ? afterRoom.substring(0, cutIdx) : afterRoom;
        const segments = clean.split('/').filter(Boolean);
        const spaceId = segments[0];
        const threadId = segments[1];
        if (spaceId && threadId) {
            return `spaces/${spaceId}/threads/${threadId}`;
        }
    }
    return null;
};
