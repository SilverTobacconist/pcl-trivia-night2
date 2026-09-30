import { timingSafeEqual } from "crypto";

export function hasBartenderAccess(request: Request) {
  const expected = process.env.BARTENDER_CONSOLE_KEY;
  const supplied = request.headers.get("x-bartender-key");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
