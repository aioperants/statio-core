/** What pictures the server accepts (already shrunk in the browser, see lib/shrink-image): checked on every upload. */
const PHOTO = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/;
const LOGO = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export const okPhoto = (data: string) => PHOTO.test(data) && data.length <= 900_000;
export const okLogo = (data: string) => LOGO.test(data) && data.length < 700_000;
