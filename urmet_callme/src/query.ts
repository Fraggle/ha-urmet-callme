import { buildToken } from "./token.js";

export function randId(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

// SipRequestMessageBody (version 2). token = sha1(ts$INCOMING_password).
export function buildBody(opts: {
  typeReq: string;
  channel: number;
  responseUri: string;
  tokenPassword: string;
  ts?: number;
  id?: number;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const id = opts.id ?? randId();
  const body: Record<string, unknown> = {
    channel: opts.channel,
    id,
    response_uri: opts.responseUri,
    token: buildToken(ts, opts.tokenPassword),
    ts,
    type: opts.typeReq,
    version: 2,
  };
  if (opts.extra) Object.assign(body, opts.extra);
  return body;
}
