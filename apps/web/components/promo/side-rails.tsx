'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PromoTile {
  id: string;
  rail: 'LEFT_AD' | 'RIGHT_SOCIAL';
  title: string | null;
  imageUrl: string;
  videoUrl: string | null;
  linkUrl: string;
  network: 'INSTAGRAM' | 'TIKTOK' | null;
}

const NETWORK_LABEL: Record<'INSTAGRAM' | 'TIKTOK', string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
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

  return (
    <a
      ref={anchor}
      href={tile.linkUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={onClick}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className="group relative block overflow-hidden rounded-xl border border-white/10 transition hover:border-bronze/60"
    >
      <img
        src={tile.imageUrl}
        alt={tile.title ?? ''}
        loading="lazy"
        className="aspect-[9/16] w-full object-cover"
      />
      {tile.videoUrl ? (
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
