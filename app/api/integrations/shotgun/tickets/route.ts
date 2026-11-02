import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const safeFields = [
  "ticket_id", "ticket_updated_at", "ticket_canceled_at", "ticket_status",
  "ticket_scanned_at", "deal_id", "deal_title", "deal_channel",
  "deal_price", "deal_service_fee", "deal_user_service_fee",
  "order_id", "currency", "payment_method", "utm_source",
  "utm_medium", "ordered_at", "event_id"
] as const;

export async function GET(request: NextRequest) {
  // Do not expose this route on a public deployment without organizer authentication.
  if (process.env.NODE_ENV === "production" && (!process.env.EVENT_SIGNAL_INTERNAL_API_KEY || process.env.EVENT_SIGNAL_INTERNAL_API_KEY !== request.headers.get("x-event-signal-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.SHOTGUN_API_TOKEN;
  const organizerId = process.env.SHOTGUN_ORGANIZER_ID;
  if (!token || !organizerId) {
    return NextResponse.json({ status: "not_connected", message: "Set SHOTGUN_ORGANIZER_ID and SHOTGUN_API_TOKEN in .env.local." }, { status: 503 });
  }
  const eventId = request.nextUrl.searchParams.get("event_id");
  const after = request.nextUrl.searchParams.get("after");
  if (eventId && !/^\d+$/.test(eventId)) return NextResponse.json({ error: "Invalid event_id" }, { status: 400 });
  if (after && (after.length > 120 || !/^[\w.:+\- ]+$/.test(after))) return NextResponse.json({ error: "Invalid after" }, { status: 400 });
  const url = new URL("https://api.shotgun.live/tickets");
  url.searchParams.set("organizer_id", organizerId);
  if (eventId) url.searchParams.set("event_id", eventId);
  if (after) url.searchParams.set("after", after);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return NextResponse.json({ status: "error", message: "Shotgun API rejected the request.", httpStatus: response.status }, { status: 502 });
    const payload = await response.json();
    const tickets = Array.isArray(payload.data) ? payload.data.map((ticket: Record<string, unknown>) =>
      Object.fromEntries(safeFields.map(field => [field, ticket[field] ?? null]))
    ) : [];
    // Never forward the provider pagination URL: it may contain credentials.
    const nextUrl = typeof payload.pagination?.next === "string" ? new URL(payload.pagination.next) : null;
    const nextCursor = nextUrl?.hostname === "api.shotgun.live" ? nextUrl.searchParams.get("after") : null;
    return NextResponse.json({ status: "connected", source: "shotgun", count: tickets.length, tickets, nextCursor }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", message: "Shotgun API unavailable." }, { status: 502 });
  }
}
