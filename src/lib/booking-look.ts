/** How the booking page looks: like the salon's website, or clean black and white. */
export type BookingLook = "site" | "clean";

/** The salon's choice; anything else (or nothing) is the website's look. */
export const bookingLookOf = (chosen: string | null | undefined): BookingLook => (chosen === "clean" ? "clean" : "site");
