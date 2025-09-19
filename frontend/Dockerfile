FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
COPY styles ./styles
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.next ./.next
COPY --from=deps /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
