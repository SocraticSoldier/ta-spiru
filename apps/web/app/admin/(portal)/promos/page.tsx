import type { JSX } from 'react';
import { apiFetch } from '@/lib/api';
import { requireRole } from '@/lib/require-role';
import { createPromo, deletePromo, togglePromo } from './actions';

interface PromoTileRow {
  id: string;
  rail: 'LEFT_AD' | 'RIGHT_SOCIAL';
  title: string | null;
  imageUrl: string;
  videoUrl: string | null;
  linkUrl: string;
  network: 'INSTAGRAM' | 'TIKTOK' | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
}

const input =
  'rounded-lg border border-white/10 bg-graphite-deep px-3 py-2 text-sm text-white outline-none focus:border-bronze';

const RailBlock = ({ rail, tiles }: { rail: PromoTileRow['rail']; tiles: PromoTileRow[] }): JSX.Element => (
  <div className="mt-8">
    <h2 className="text-2xl">{rail === 'LEFT_AD' ? 'Left rail — offers' : 'Right rail — reels'}</h2>
    <p className="mt-1 text-sm text-white/45">
      {rail === 'LEFT_AD'
        ? 'House offers and partner ads down the left of the site.'
        : 'Your latest Instagram and TikTok posts down the right. Clicking opens the real post.'}
    </p>
    {tiles.length === 0 ? (
      <p className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
        Nothing on this rail yet.
      </p>
    ) : (
      <div className="mt-4 flex flex-col gap-2">
        {tiles.map((t) => {
          const rate = t.impressions > 0 ? Math.round((t.clicks / t.impressions) * 1000) / 10 : null;
          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-graphite px-3 py-2.5 text-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.imageUrl} alt="" className="h-14 w-9 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.title ?? '(untitled)'}</span>
                <span className="block truncate text-xs text-white/40">{t.linkUrl}</span>
              </span>
              {t.network ? (
                <span className="rounded bg-bronze/15 px-1.5 py-0.5 text-xs text-bronze-light">
                  {t.network === 'INSTAGRAM' ? 'Instagram' : 'TikTok'}
                </span>
              ) : null}
              {t.videoUrl ? <span className="text-xs text-white/35">clip</span> : null}
              <span className="text-xs text-white/40">#{t.sortOrder}</span>
              <span className="text-xs text-white/50">
                {t.clicks} / {t.impressions}
                {rate !== null ? ` · ${rate}%` : ''}
              </span>
              {t.startsAt || t.endsAt ? (
                <span className="text-xs text-white/35">
                  {t.startsAt ? t.startsAt.slice(0, 10) : '…'} → {t.endsAt ? t.endsAt.slice(0, 10) : '…'}
                </span>
              ) : null}
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  t.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/40'
                }`}
              >
                {t.isActive ? 'Live' : 'Off'}
              </span>
              <form action={togglePromo}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="isActive" value={String(t.isActive)} />
                <button
                  type="submit"
                  className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/60 transition hover:text-white"
                >
                  {t.isActive ? 'Pause' : 'Go live'}
                </button>
              </form>
              <form action={deletePromo}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-xs text-red-400/70 transition hover:text-red-400">
                  Delete
                </button>
              </form>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const PromosPage = async (): Promise<JSX.Element> => {
  // Ads and social posts are the shop window — owner and managers only.
  await requireRole('ADMIN', 'MANAGER');

  let tiles: PromoTileRow[] = [];
  let loadFailed = false;
  try {
    tiles = await apiFetch<PromoTileRow[]>('/promos/all');
  } catch {
    loadFailed = true;
  }

  return (
    <section>
      <h1 className="text-4xl">Side rails</h1>
      <p className="mt-2 max-w-2xl text-sm text-white/50">
        The two columns beside the website on wide screens. They are hidden on phones and on every staff
        screen, and the site works perfectly without them.
      </p>
      <p className="mt-3 max-w-2xl rounded-xl border border-white/10 bg-graphite/60 p-3 text-xs text-white/45">
        Instagram and TikTok do not let another site play their videos. So each reel tile holds your own
        poster image (and optionally a short muted clip) and links out to the real post — which is where
        you want the likes and follows landing anyway.
      </p>

      {loadFailed ? (
        <p className="mt-8 rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
          Could not load the rails — try again shortly.
        </p>
      ) : null}

      <RailBlock rail="LEFT_AD" tiles={tiles.filter((t) => t.rail === 'LEFT_AD')} />
      <RailBlock rail="RIGHT_SOCIAL" tiles={tiles.filter((t) => t.rail === 'RIGHT_SOCIAL')} />

      <div className="mt-10 rounded-2xl border border-white/10 bg-graphite p-6">
        <h2 className="text-2xl">Add a tile</h2>
        <form action={createPromo} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Rail
            <select name="rail" required defaultValue="RIGHT_SOCIAL" className={input}>
              <option value="LEFT_AD">Left — offer / ad</option>
              <option value="RIGHT_SOCIAL">Right — reel</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Network (reels only)
            <select name="network" defaultValue="INSTAGRAM" className={input}>
              <option value="INSTAGRAM">Instagram</option>
              <option value="TIKTOK">TikTok</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Caption
            <input name="title" type="text" placeholder="Optional" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60 sm:col-span-2">
            Poster image URL
            <input name="imageUrl" type="text" required placeholder="/promos/reel-1.jpg" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Preview clip URL
            <input name="videoUrl" type="text" placeholder="Optional .mp4" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60 sm:col-span-2">
            Links to
            <input
              name="linkUrl"
              type="text"
              required
              placeholder="https://www.instagram.com/reel/…"
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Order
            <input name="sortOrder" type="number" defaultValue={0} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Starts (optional)
            <input name="startsAt" type="date" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/60">
            Ends (optional)
            <input name="endsAt" type="date" className={input} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-bronze px-5 py-2.5 font-medium text-graphite-deep transition hover:bg-bronze-light"
            >
              Add tile
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default PromosPage;
