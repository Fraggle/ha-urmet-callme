# Multi-arch Debian trixie base (resolves per-arch automatically, so no build.yaml / per-arch base
# mapping is needed). Debian trixie ships the liblinphone stack + its openh264 plugin under the same
# package names as Ubuntu (liblinphone 5.3.105 -- new enough for recv.c's factory_set_cache_dir;
# bookworm's 5.1.65 is too old -- plus mediastreamer2-plugin-openh264 and ffmpeg). There's no S6 here,
# so config.yaml sets init: true (tini reaps our ffmpeg/go2rtc/stream.sh grandchildren).
#
# MULTI-STAGE: the build tooling (build-essential + the *-dev headers, ~100-180 MB) is needed only to
# compile recv/opendoor and the TS, never at runtime. Now that CI builds the image and users only PULL
# it (see .github/workflows/builder.yml), CI build time is free and the only thing users pay for is the
# image SIZE -- so we split the build tooling into a throwaway `builder` stage and ship a lean runtime
# stage with only the runtime libraries. (The old single-stage image carried the compilers/headers to
# every user; this halves-ish the download.) The earlier "stay single-stage" note applied when the
# add-on built ON the user's box -- no longer the case with pre-built GHCR images.

# ---------- builder: compile everything ----------
FROM debian:trixie-slim AS builder
ENV DEBIAN_FRONTEND=noninteractive

# *-dev packages provide the headers + .so symlinks the recv/opendoor link step needs (Debian's
# liblinphone-dev doesn't pull libmediastreamer-dev / libortp-dev, so name them explicitly). go2rtc is
# a static Go binary downloaded here and copied into the runtime stage (no curl needed at runtime).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg build-essential pkg-config \
      liblinphone-dev libmediastreamer-dev libortp-dev \
 && curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh \
 && bash /tmp/nodesource.sh \
 && apt-get install -y --no-install-recommends nodejs \
 && command -v npm && node --version \
 && curl -fsSL -o /usr/local/bin/go2rtc \
      "https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_$(dpkg --print-architecture)" \
 && chmod +x /usr/local/bin/go2rtc \
 && rm -rf /var/lib/apt/lists/* /tmp/nodesource.sh

WORKDIR /app
COPY package.json package-lock.json* tsconfig.json tsconfig.build.json ./
RUN npm ci
COPY src ./src
COPY video-recv/recv.c ./recv.c
COPY video-recv/opendoor.c ./opendoor.c
COPY stream.sh ./stream.sh

# Build the TS control plane, compile the liblinphone receiver + 2Voice door-opener, drop dev deps so
# only the production node_modules (mqtt) is carried into the runtime stage.
RUN npm run build \
 && cc -O2 -Wall recv.c -llinphone -lbctoolbox -lbellesip -lmediastreamer2 -lortp \
      -o /usr/local/bin/recv \
 && cc -O2 -Wall opendoor.c -llinphone -lbctoolbox -lbellesip -lmediastreamer2 -lortp \
      -o /usr/local/bin/opendoor \
 && npm prune --omit=dev

# ---------- runtime: lean image users pull ----------
FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive NODE_ENV=production

# Runtime libraries only -- NO compilers or -dev headers. linphone-cli is REQUIRED (not for its
# binaries): it pulls the runtime liblinphone AND linphone-common, which ships
# /usr/share/belr/grammars/identity_grammar -- without it liblinphone FATALs ("Unable to load Identity
# Address grammar") and recv crash-loops. It transitively pulls the runtime .so's recv/opendoor link
# against (liblinphone, bctoolbox, belle-sip, mediastreamer2, ortp); the openh264 plugin + ffmpeg add
# H.264. Node is installed via the same proven nodesource path as the builder (matching v22); curl +
# gnupg are needed only to add the nodesource repo, then purged.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
      linphone-cli mediastreamer2-plugin-openh264 ffmpeg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh \
 && bash /tmp/nodesource.sh \
 && apt-get install -y --no-install-recommends nodejs \
 && command -v node && node --version \
 && apt-get purge -y --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/* /tmp/nodesource.sh

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/stream.sh ./stream.sh
COPY --from=builder /usr/local/bin/recv /usr/local/bin/recv
COPY --from=builder /usr/local/bin/opendoor /usr/local/bin/opendoor
COPY --from=builder /usr/local/bin/go2rtc /usr/local/bin/go2rtc

# Generate the black H.264 priming keyframe (SPS+PPS+IDR, CIF 352x288 baseline): recv writes it to the
# output FIFO at the start of each call so ffmpeg (and thus go2rtc) can ADVERTISE the video track
# immediately, before the panel's first real keyframe (~4s later) -- otherwise the on-demand WebRTC
# negotiation completes with no track and the viewer locks in a black session until a refresh.
RUN chmod +x /app/stream.sh /usr/local/bin/go2rtc /usr/local/bin/recv /usr/local/bin/opendoor \
 && ffmpeg -hide_banner -loglevel error -f lavfi -i color=black:s=352x288:r=25 \
      -frames:v 1 -c:v libx264 -profile:v baseline -pix_fmt yuv420p -f h264 /app/black.h264

CMD ["node", "dist/index.js"]
