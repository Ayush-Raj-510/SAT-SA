# SAT-SA frontend — production build, served by Nginx.

FROM node:20-alpine AS build
WORKDIR /app

# Install from the lockfile so the image is reproducible. `npm install` with a
# bare manifest can resolve different versions on each build.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
