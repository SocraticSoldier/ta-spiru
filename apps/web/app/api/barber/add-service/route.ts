import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';

interface Body {
  appointmentId?: string;
  serviceId?: string;
  acceptOverlap?: boolean;
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.appointmentId || !body.serviceId) {
    return NextResponse.json({ message: 'appointmentId and serviceId are required' }, { status: 400 });
  }
  try {
    const result = await apiFetch(`/bookings/${body.appointmentId}/add-service`, {
      method: 'POST',
      body: JSON.stringify({ serviceId: body.serviceId, acceptOverlap: body.acceptOverlap }),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Add service failed' }, { status: 502 });
  }
};
