// UrmetCrypto: a repeating 32-byte XOR with a per-blob key appended to the ciphertext.
// The 32-byte static key below is a fixed, public constant of the scheme.
const STATIC_KEY = [
  25,
  34,
  242,
  185,
  102,
  22,
  241,
  144,
  0,
  255,
  255,
  169,
  97,
  68,
  79,
  139,
  229,
  63,
  246,
  35,
  155,
  215,
  224,
  116,
  202, // index 24
  127,
  236,
  71,
  55,
  175,
  192,
  232,
];
const KEY_SIZE = 32;
// UrmetCrypto has TWO framings. For payloads below KEY_POS+KEY_SIZE (1498752+32) the masked 32-byte
// key is simply APPENDED at the end (the form implemented here). At/above that size it is instead
// embedded MID-STREAM at fixed offset 1498752, splitting the ciphertext around it. sipdata is a few
// hundred bytes, so it always uses the append form; the embedded-key variant is not handled (no such
// large payload on the door-open/sipdata path) and decrypt fails loudly if one appears.
const EMBED_LIMIT = 1498752 + KEY_SIZE;

export function decrypt(blob: Buffer): Buffer {
  if (blob.length === 0) return Buffer.alloc(0);
  if (blob.length < KEY_SIZE) throw new Error("blob shorter than key block");
  if (blob.length >= EMBED_LIMIT)
    throw new Error(
      "blob too large for the key-at-end form (embedded-key variant unsupported)",
    );
  const body = blob.subarray(0, blob.length - KEY_SIZE);
  const masked = blob.subarray(blob.length - KEY_SIZE);
  const perKey = Buffer.alloc(KEY_SIZE);
  for (let j = 0; j < KEY_SIZE; j++)
    perKey[j] = (masked[j] ^ STATIC_KEY[j]) & 0xff;
  const out = Buffer.alloc(body.length);
  for (let k = 0; k < body.length; k++)
    out[k] = (body[k] ^ perKey[k % KEY_SIZE]) & 0xff;
  return out;
}
