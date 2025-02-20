FROM node:18.17.0-alpine

ARG PUID
ARG PGID

LABEL maintainer="Nightscout Contributors"

WORKDIR /opt/app
RUN chown -R ${PUID:-1000}:${PGID:-1000} /opt/app
ADD . /opt/app

COPY ./node_modules ./node_modules
# TODO: We should be able to do `RUN npm install --only=production`.
# For this to work, we need to copy only package.json and things needed for `npm`'s to succeed.
# TODO: Do we need to re-add `npm audit fix`? Or should that be part of a development process/stage?
RUN npm install --cache /tmp/empty-cache && \
  npm run postinstall && \
  npm run env && \
  rm -rf /tmp/*
  # TODO: These should be added in the future to correctly cache express-minify content to disk
  # Currently, doing this breaks the browser cache.
  # mkdir /tmp/public && \
  # chown node:node /tmp/public
USER node
EXPOSE 1337

CMD ["node", "lib/server/server.js"]
