FROM node:22-alpine

WORKDIR /app

# Install build dependencies for node-gyp (required for bcrypt on Alpine)
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

# This single image serves BOTH Cloud Run services — the command is what makes them
# different processes, not the image:
#   2qt-api    (default, this CMD): Express + Socket.IO, autoscaling, many instances
#   2qt-worker (override the command at deploy time): BullMQ workers + node-cron,
#              pinned to exactly 1 instance — see src/worker.ts for why that matters.
#
#   gcloud run deploy 2qt-worker --image <this image> --command "node" --args "dist/worker.js" \
#     --min-instances 1 --max-instances 1
#
# Do not run `npm run start:worker` on more than one instance — cron jobs are only
# guaranteed to fire exactly once if exactly one worker instance is ever running.
CMD ["npm", "start"]
