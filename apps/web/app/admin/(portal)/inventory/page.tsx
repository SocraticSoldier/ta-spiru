import type { JSX } from 'react';
import { Placeholder } from '@/components/admin/placeholder';

const InventoryPage = (): JSX.Element => (
  <Placeholder
    title="Inventory"
    phase="Phase 2"
    description="Multi-location stock levels, intake and transfers backed by the central movement ledger, plus camera-based barcode scanning."
  />
);

export default InventoryPage;
