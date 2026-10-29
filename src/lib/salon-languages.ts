import "server-only";
import { requireBusiness } from "./booking";
import { langOptions } from "./languages";

/** The salon writes its own texts once, in its language for clients. */
export async function salonLanguages() {
  const business = await requireBusiness();
  const codes = [business.defaultLocale];
  return { business, codes, options: langOptions(codes), fallback: business.defaultLocale };
}
