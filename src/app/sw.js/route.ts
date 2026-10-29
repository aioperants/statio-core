/**
 * The service worker for the team's notifications (lib/push): shows each one and opens the right
 * page when it's tapped, reusing an open Statio window when there is one. Nothing is cached.
 */
const worker = `
self.addEventListener("push", (event) => {
  const n = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(n.title || "", { body: n.body || "", tag: n.tag, data: { url: n.url || "/" }, icon: "/api/icon?size=192" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const same = open.find((c) => new URL(c.url).origin === self.location.origin);
      return same ? same.navigate(url).then((c) => (c || same).focus()) : self.clients.openWindow(url);
    }),
  );
});
`;

export function GET() {
  return new Response(worker, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", "service-worker-allowed": "/" } });
}
