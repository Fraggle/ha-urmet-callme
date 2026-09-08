// The Home Assistant ingress web UI (authenticated, proxied by HA - no exposed port). Its ONLY job
// is to host the embedded go2rtc web UI (live camera streams) when video is enabled: go2rtc's UI uses
// relative paths, so it resolves under the ingress sub-path, and WebRTC/MSE signalling runs over the
// proxied WebSocket while media flows on go2rtc's own (host-networked) path. With video OFF there is
// nothing to show - the entities and the add-on log already report status - so we serve a blank page
// rather than a redundant status dashboard. (ingress: true also raises the add-on security rating.)
// Bound on 0.0.0.0 so the HA ingress proxy can reach it.
import { createServer, request as httpRequest, ServerResponse } from "node:http";
import { connect as netConnect } from "node:net";
import { logger } from "./logger.js";

const log = logger("ingress");

export const INGRESS_PORT = 8098; // must match config.yaml `ingress_port`

// A blank, theme-aware page (CSS system color `Canvas` follows the viewer's light/dark theme).
// `refresh` is set only while waiting for go2rtc to come up, so the panel self-heals into the camera
// UI once it answers; the video-off page is static.
function blankPage(refreshSeconds?: number): string {
  const refresh = refreshSeconds
    ? `<meta http-equiv="refresh" content="${refreshSeconds}">`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${refresh}
<title>Urmet CallMe</title>
<style>:root{color-scheme:light dark}html,body{margin:0;height:100%;background:Canvas}</style>
</head><body></body></html>`;
}

function sendPage(res: ServerResponse, html: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

export function startIngressServer(
  videoEnabled: boolean,
  go2rtcApiPort: number,
): void {
  // HTTP: with video on, proxy to go2rtc (its camera UI); on connection error (go2rtc still starting)
  // serve a short auto-refreshing blank page so it self-heals. With video off, always blank.
  const server = createServer((req, res) => {
    if (!videoEnabled) return void sendPage(res, blankPage());
    const proxyReq = httpRequest(
      {
        host: "127.0.0.1",
        port: go2rtcApiPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (pr) => {
        res.writeHead(pr.statusCode || 502, pr.headers);
        pr.pipe(res);
      },
    );
    proxyReq.on("error", () => {
      if (res.headersSent) return void res.end();
      sendPage(res, blankPage(3));
    });
    req.pipe(proxyReq);
  });
  // WebSocket: forward the upgrade to go2rtc (its WebRTC/MSE players signal over ws). Only meaningful
  // with video on; otherwise drop it.
  server.on("upgrade", (req, socket, head) => {
    if (!videoEnabled) return void socket.destroy();
    const up = netConnect(go2rtcApiPort, "127.0.0.1", () => {
      let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (let i = 0; i < req.rawHeaders.length; i += 2)
        raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
      up.write(raw + "\r\n");
      if (head && head.length) up.write(head);
      up.pipe(socket);
      socket.pipe(up);
    });
    up.on("error", () => socket.destroy());
    socket.on("error", () => up.destroy());
  });
  server.on("error", (e) =>
    log.error(`ingress server error: ${(e as Error).message}`),
  );
  server.listen(INGRESS_PORT, "0.0.0.0", () =>
    log.info(
      videoEnabled
        ? `ingress panel on :${INGRESS_PORT} (proxying go2rtc :${go2rtcApiPort} when up)`
        : `ingress panel on :${INGRESS_PORT} (blank - video off)`,
    ),
  );
}
