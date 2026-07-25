import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';

interface Body {
  amountCents?: number;
  appointmentId?: string;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.amountCents || body.amountCents < 1) {
    return NextResponse.json({ message: 'amountCents is required' }, { status: 400 });
  }
  try {
    const result = await apiFetch('/team/me/tips', {
      method: 'POST',
      body: JSON.stringify({ amountCents: body.amountCents, appointmentId: body.appointmentId }),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Could not record the tip' }, { status: 502 });
  }
};
