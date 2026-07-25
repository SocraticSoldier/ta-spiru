import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';

interface Body {
  appointmentId?: string;
  status?: string;
}

export const PATCH = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.appointmentId || !body.status) {
    return NextResponse.json({ message: 'appointmentId and status are required' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/bookings/${body.appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: body.status }),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Status update failed' }, { status: 502 });
  }
};
