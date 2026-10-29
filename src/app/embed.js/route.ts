/**
 * <script src="https://book.salon.com/embed.js" data-lang="es" async></script>
 * Puts the booking page into the salon's website, inside <div id="statio-booking"> if present
 * (or right after the script tag), and grows the frame to fit its content.
 * data-button="Reservar" shows a floating button that opens booking full screen instead.
 */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const js = `(function(){
var s=document.currentScript;if(!s)return;
var lang=s.getAttribute("data-lang")||"es";var label=s.getAttribute("data-button");
var src=${JSON.stringify(origin)}+"/"+lang+"/book";
if(label){var b=document.createElement("a");b.href=src;b.textContent=label;b.target="_blank";b.rel="noopener";
b.style.cssText="position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:14px 22px;border-radius:999px;background:"+(s.getAttribute("data-color")||"#111111")+";color:#fff;font:600 16px system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.2)";
document.body.appendChild(b);return;}
var f=document.createElement("iframe");f.src=src;f.title="Booking";f.loading="lazy";
f.style.cssText="width:100%;min-height:640px;border:0;display:block;color-scheme:light";
var host=document.getElementById("statio-booking");if(host)host.appendChild(f);else s.parentNode.insertBefore(f,s.nextSibling);
window.addEventListener("message",function(e){if(e.origin!==${JSON.stringify(origin)}||!e.data||e.data.type!=="statio:height")return;f.style.height=Math.max(640,e.data.height)+"px";});
})();`;
  return new Response(js, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
