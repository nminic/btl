FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-fund --no-audit
COPY . .
# Shows the development controls: the role switch and the switch that moves the
# day the portal is read as. The QA compose file sets it to 1; production sets
# nothing, and both are then absent from the bundle's behaviour.
ARG VITE_DEV_TOOLS
ENV VITE_DEV_TOOLS=$VITE_DEV_TOOLS
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
