/**
 * Vimeo is the one video host that lets another site actually play the video.
 *
 * Instagram and TikTok give you nothing embeddable — their official embeds are
 * heavy third-party scripts that get blocked — so those tiles stay as a poster
 * that links out. A Vimeo tile can play inline in the rail instead.
 */

/** The numeric id out of any of the shapes people paste. Null if it isn't Vimeo. */
export const vimeoIdFrom = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  // Someone may just paste the id.
  if (/^\d+$/.test(value)) return value;
  if (!/vimeo\.com/i.test(value)) return null;
  // vimeo.com/123, player.vimeo.com/video/123, vimeo.com/channels/x/123,
  // and unlisted links like vimeo.com/123/abcdef0123.
  const match = value.match(/vimeo\.com\/(?:.*\/)?(\d+)/i);
  return match?.[1] ?? null;
};

export const isVimeo = (raw: string | null | undefined): boolean =>
  Boolean(raw && vimeoIdFrom(raw));

/**
 * A chrome-less looping player for a side rail.
 *
 * `background=1` is the important one: no controls, no title, muted, looping —
 * the video behaves like a moving poster rather than a player someone has to
 * operate. Autoplay is opt-in so tiles further down the rail stay idle until
 * they are actually on screen.
 */
export const vimeoEmbedUrl = (raw: string, options: { autoplay?: boolean } = {}): string | null => {
  const id = vimeoIdFrom(raw);
  if (!id) return null;
  const params = [
    'background=1',
    'muted=1',
    'loop=1',
    'autopause=0',
    'dnt=1', // ask Vimeo not to track the viewer
    `autoplay=${options.autoplay ? '1' : '0'}`,
  ].join('&');
  return `https://player.vimeo.com/video/${id}?${params}`;
};

/** Where a click should land — the watch page, not the bare player. */
export const vimeoWatchUrl = (raw: string): string | null => {
  const id = vimeoIdFrom(raw);
  return id ? `https://vimeo.com/${id}` : null;
};
