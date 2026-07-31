import type { JSX } from 'react';
import type { TransactionRow } from '@ta-spiru/shared';
import { apiFetch } from '@/lib/api';
import { formatEuro, LEDGER_TAG_LABELS } from '@/lib/format';
import { requireRole } from '@/lib/require-role';

const getTransactions = async (): Promise<TransactionRow[] | null> => {
  try {
    return await apiFetch<TransactionRow[]>('/payments/transactions?limit=50');
  } catch {
    return null;
  }
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  AUTHORISED: 'bg-sky-500/15 text-sky-400',
  SETTLED: 'bg-emerald-500/10 text-emerald-400',
  DECLINED: 'bg-red-500/15 text-red-400',
  REFUNDED: 'bg-white/10 text-white/60',
  CANCELLED: 'bg-white/10 text-white/60',
};

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-MT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Malta',
  });

const TransactionsPage = async (): Promise<JSX.Element> => {
  // Money: owner only.
  await requireRole('ADMIN');

  const transactions = await getTransactions();

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h1 className="text-4xl">Transactions</h1>
        <p className="text-sm text-white/50">Trust Payments ledger · latest 50</p>
      </div>

      {transactions === null ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          Ledger unavailable — check that the API is running and your role is ADMIN.
        </div>
      ) : transactions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm text-white/50">
          No transactions recorded yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-graphite text-white/60">
              <tr>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Channel</th>
                <th className="px-4 py-2.5 font-medium">Splits</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-white/70">
                    {formatDateTime(transaction.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                    {transaction.transactionReference ?? transaction.paymentReference}
                  </td>
                  <td className="px-4 py-2.5">{transaction.customerName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-white/60">
                    {transaction.channel === 'POS_TERMINAL' ? 'POS' : 'Online'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-white/60">
                    {transaction.splits
                      .map(
                        (split) =>
                          `${LEDGER_TAG_LABELS[split.ledgerTag] ?? split.ledgerTag}: ${formatEuro(split.amountCents)}`,
                      )
                      .join(' · ') || '—'}
                  </td>
                  <td className="font-display px-4 py-2.5 text-right text-base">
                    {formatEuro(transaction.amountCents)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[transaction.status] ?? 'bg-white/10 text-white/60'}`}
                    >
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default TransactionsPage;
