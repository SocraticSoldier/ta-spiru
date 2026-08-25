'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { isVimeo, vimeoEmbedUrl, vimeoWatchUrl } from '@ta-spiru/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PromoTile {
  id: string;
  rail: 'LEFT_AD' | 'RIGHT_SOCIAL';
  title: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string;
  network: 'INSTAGRAM' | 'TIKTOK' | 'VIMEO' | null;
}

const NETWORK_LABEL: Record<'INSTAGRAM' | 'TIKTOK' | 'VIMEO', string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  VIMEO: 'Vimeo',
};

/**
 * One tile. The poster always renders; a preview clip, if there is one, plays
 * muted on hover and stops on the way out — nothing autoplays with sound, and
 * nothing plays at all for someone who has asked for reduced motion.
 */
const Tile = ({ tile }: { tile: PromoTile }): JSX.Element => {
  const video = useRef<HTMLVideoElement | null>(null);
  const anchor = useRef<HTMLAnchorElement | null>(null);
  const [counted, setCounted] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  // Count a view the first time the tile is actually on screen, not on render.
  useEffect(() => {
    const el = anchor.current;
    if (!el || counted) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCounted(true);
          void fetch(`${API_URL}/api/v1/promos/${tile.id}/impression`, {
            method: 'POST',
            keepalive: true,
          }).catch(() => undefined);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tile.id, counted]);

  const play = (): void => {
    const el = video.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void el.play().catch(() => undefined);
  };
  const stop = (): void => {
    const el = video.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  // Count the click, then follow the link. The navigation happens either way —
  // a counter being down is no reason to break the link.
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    void fetch(`${API_URL}/api/v1/promos/${tile.id}/click`, { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
  };

  // A Vimeo tile plays for real; anything else is a poster that links out.
  const vimeoSrc = tile.videoUrl && isVimeo(tile.videoUrl) ? vimeoEmbedUrl(tile.videoUrl, { autoplay: true }) : null;
  const href = vimeoSrc ? (vimeoWatchUrl(tile.videoUrl ?? '') ?? tile.linkUrl) : tile.linkUrl;

  return (
    <a
      ref={anchor}
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={onClick}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className="group relative block overflow-hidden rounded-xl border border-white/10 transition hover:border-bronze/60"
    >
      {tile.imageUrl && !posterFailed ? (
        <img
          src={tile.imageUrl}
          alt={tile.title ?? ''}
          loading="lazy"
          onError={() => setPosterFailed(true)}
          className="aspect-[9/16] w-full object-cover"
        />
      ) : (
        // Holds the tile's shape while the player loads, and catches a poster
        // path that 404s — a mistyped filename should leave a quiet dark box,
        // not broken-image alt text sprawled across the rail.
        <div className="aspect-[9/16] w-full bg-graphite" />
      )}

      {vimeoSrc && counted ? (
        // Mounted only once the tile has been on screen, so a rail of reels
        // does not pull half a dozen players on first paint. pointer-events
        // are off so the click belongs to the link, not the iframe.
        <iframe
          src={vimeoSrc}
          title={tile.title ?? 'Reel'}
          loading="lazy"
          allow="autoplay; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          // bg-graphite matters: if Vimeo is blocked or slow the frame paints
          // its own white default, which is glaring on a dark rail.
          className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-graphite object-cover"
        />
      ) : null}

      {!vimeoSrc && tile.videoUrl ? (
        <video
          ref={video}
          src={tile.videoUrl}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      ) : null}

      {tile.network ? (
        <span className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
          {NETWORK_LABEL[tile.network]}
        </span>
      ) : null}

      {tile.title ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 text-xs text-white/90">
          {tile.title}
        </span>
      ) : null}
    </a>
  );
};

/**
 * The two side rails.
 *
 * Only shown on screens wide enough to have room beside the content — below
 * that they would squeeze the page, so they are simply not rendered. Nothing
 * here is required to use the site.
 */
/** Staff screens are work, not shop window — no rails on any of them. */
const STAFF_PREFIXES = ['/admin', '/my-day', '/kiosk', '/display', '/station-login'];

export const SideRails = (): JSX.Element | null => {
  const pathname = usePathname();
  const [tiles, setTiles] = useState<PromoTile[]>([]);
  const onStaffScreen = STAFF_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    if (onStaffScreen) return;
    fetch(`${API_URL}/api/v1/promos`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: PromoTile[]) => setTiles(Array.isArray(rows) ? rows : []))
      .catch(() => setTiles([]));
  }, [onStaffScreen]);

  if (onStaffScreen) return null;

  const ads = tiles.filter((t) => t.rail === 'LEFT_AD');
  const social = tiles.filter((t) => t.rail === 'RIGHT_SOCIAL');
  if (ads.length === 0 && social.length === 0) return null;

  const rail = (items: PromoTile[], side: 'left' | 'right', heading: string): JSX.Element | null =>
    items.length === 0 ? null : (
      <aside
        aria-label={heading}
        className={`pointer-events-none fixed top-0 z-30 hidden h-screen w-[168px] flex-col gap-3 overflow-y-auto px-3 py-6 xl:flex ${
          side === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">{heading}</p>
        <div className="pointer-events-auto flex flex-col gap-3">
          {items.map((tile) => (
            <Tile key={tile.id} tile={tile} />
          ))}
        </div>
      </aside>
    );

  return (
    <>
      {rail(ads, 'left', 'Offers')}
      {rail(social, 'right', 'Latest reels')}
    </>
  );
};
