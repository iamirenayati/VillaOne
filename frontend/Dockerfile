FROM node:22.13.1-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_VILLAONE_API_URL=/api/v1
ARG NEXT_PUBLIC_VILLAONE_SITE_URL=https://villaone.example
ENV NEXT_PUBLIC_VILLAONE_API_URL=${NEXT_PUBLIC_VILLAONE_API_URL} \
    NEXT_PUBLIC_VILLAONE_SITE_URL=${NEXT_PUBLIC_VILLAONE_SITE_URL}
RUN npm run build

FROM node:22.13.1-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3001
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "3001"]
