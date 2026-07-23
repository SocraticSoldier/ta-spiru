import type { JSX } from 'react';
import type { StockLevelRow } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';

const getLevels = async (): Promise<StockLevelRow[] | null> => {
  try {
    return await apiFetch<StockLevelRow[]>('/inventory/levels');
  } catch {
    return null;
  }
};

const InventoryPage = async (): Promise<JSX.Element> => {
  const levels = await getLevels();
  const byLocation = new Map<string, StockLevelRow[]>();
  for (const row of levels ?? []) {
    const bucket = byLocation.get(row.locationName) ?? [];
    bucket.push(row);
    byLocation.set(row.locationName, bucket);
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-white/50">Central ledger · all branches</p>
      </div>

      {levels === null ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          Stock levels unavailable — check that the API is running and your account has a staff role.
        </div>
      ) : null}

      {[...byLocation.entries()].map(([locationName, rows]) => (
        <div key={locationName} className="mt-8">
          <h2 className="text-sm uppercase tracking-[0.2em] text-white/50">{locationName}</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-graphite text-white/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 font-medium">Brand</th>
                  <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reorder at</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={`${row.productId}-${row.locationId}`}>
                    <td className="px-4 py-2.5">{row.productName}</td>
                    <td className="px-4 py-2.5 text-white/60">{row.sku}</td>
                    <td className="px-4 py-2.5 text-white/60">{row.brand ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{row.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-white/60">{row.reorderThreshold}</td>
                    <td className="px-4 py-2.5">
                      {row.lowStock ? (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs text-red-400">
                          Low stock
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
};

export default InventoryPage;
