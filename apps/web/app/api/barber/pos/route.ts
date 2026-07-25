import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';

interface Body {
  locationId?: string;
  items?: { productId: string; quantity: number }[];
  couponCode?: string;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.locationId || !body.items || body.items.length === 0) {
    return NextResponse.json({ message: 'locationId and items are required' }, { status: 400 });
  }
  try {
    const result = await apiFetch('/orders/pos', {
      method: 'POST',
      body: JSON.stringify({ locationId: body.locationId, items: body.items, couponCode: body.couponCode || undefined }),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Could not complete the sale' }, { status: 502 });
  }
};
