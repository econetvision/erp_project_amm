# Stage 1 — build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ARG REACT_APP_API_URL
ARG REACT_APP_GOOGLE_MAPS_API_KEY
ARG REACT_APP_VERSION=1.0.0
ARG REACT_APP_BUILD_SHA=dev
ARG REACT_APP_BUILD_TIME=unknown
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY
ENV REACT_APP_VERSION=$REACT_APP_VERSION
ENV REACT_APP_BUILD_SHA=$REACT_APP_BUILD_SHA
ENV REACT_APP_BUILD_TIME=$REACT_APP_BUILD_TIME
RUN npm run build

# Stage 2 — serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
