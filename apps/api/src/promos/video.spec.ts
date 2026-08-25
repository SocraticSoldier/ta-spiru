import { isVimeo, vimeoEmbedUrl, vimeoIdFrom, vimeoWatchUrl } from '@ta-spiru/shared';

describe('Vimeo link parsing', () => {
  it('pulls the id out of every shape someone might paste', () => {
    expect(vimeoIdFrom('123456789')).toBe('123456789');
    expect(vimeoIdFrom('https://vimeo.com/123456789')).toBe('123456789');
    expect(vimeoIdFrom('https://player.vimeo.com/video/123456789')).toBe('123456789');
    expect(vimeoIdFrom('https://vimeo.com/channels/staffpicks/123456789')).toBe('123456789');
    // Unlisted links carry a private hash after the id.
    expect(vimeoIdFrom('https://vimeo.com/123456789/abcdef0123')).toBe('123456789');
    expect(vimeoIdFrom('  https://vimeo.com/123456789?share=copy  ')).toBe('123456789');
  });

  it('does not claim links that are not Vimeo', () => {
    expect(vimeoIdFrom('https://www.instagram.com/reel/Cabc123/')).toBeNull();
    expect(vimeoIdFrom('https://www.tiktok.com/@taspiru/video/7300000000000000000')).toBeNull();
    expect(vimeoIdFrom('/promos/house-offer.mp4')).toBeNull();
    expect(vimeoIdFrom('')).toBeNull();
    // A Vimeo host with no numeric id is not something we can play.
    expect(vimeoIdFrom('https://vimeo.com/taspiru')).toBeNull();
  });

  it('treats a missing value as not Vimeo rather than throwing', () => {
    expect(isVimeo(null)).toBe(false);
    expect(isVimeo(undefined)).toBe(false);
    expect(isVimeo('https://vimeo.com/123')).toBe(true);
  });

  it('builds a chrome-less looping player, muted, autoplay opt-in', () => {
    const idle = vimeoEmbedUrl('https://vimeo.com/123456789');
    expect(idle).toContain('https://player.vimeo.com/video/123456789?');
    expect(idle).toContain('background=1');
    expect(idle).toContain('muted=1');
    expect(idle).toContain('loop=1');
    expect(idle).toContain('dnt=1');
    // Tiles further down the rail stay idle until they are actually seen.
    expect(idle).toContain('autoplay=0');
    expect(vimeoEmbedUrl('123456789', { autoplay: true })).toContain('autoplay=1');
  });

  it('has nothing to build or link to when the URL is not Vimeo', () => {
    expect(vimeoEmbedUrl('https://www.tiktok.com/@taspiru/video/7300000000000000000')).toBeNull();
    expect(vimeoWatchUrl('https://www.instagram.com/reel/Cabc123/')).toBeNull();
  });

  it('sends a click to the watch page, not the bare player', () => {
    expect(vimeoWatchUrl('https://player.vimeo.com/video/123456789')).toBe('https://vimeo.com/123456789');
  });
});
