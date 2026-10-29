import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { sameAddressOnly } from "@/lib/auth-guard";

const handler = toNextJsHandler(auth);

// Only requests from this same address, sending people only back to it (see lib/auth-guard).
export const GET = (req: Request) => sameAddressOnly(req, handler.GET);
export const POST = (req: Request) => sameAddressOnly(req, handler.POST);
