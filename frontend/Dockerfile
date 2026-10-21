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
# The mode is written on the command itself, so that no earlier line of this file (or a base
# image) can put the build in development: the build tool then treats the bundle as a
# development one and draws both switches whatever the flag above says.
RUN NODE_ENV=production npm run build

FROM nginx:1.29-alpine
COPY nginx-to-backend.conf /etc/nginx/nginx-to-backend.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
