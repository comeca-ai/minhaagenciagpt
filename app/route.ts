import html from "../public/index.html?raw";
export function GET(){return new Response(html.replace('src="runtime-config.js"','src="/api/runtime"'),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})}
