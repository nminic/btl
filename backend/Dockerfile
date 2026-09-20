FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q dependency:go-offline
COPY src src
RUN ./mvnw -q package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 1001 btl
# THE FOLDER THE PICTURES LIVE IN, MADE AND OWNED HERE AND NOT WHERE THEY ARE USED.
#
# Measured 20.09.2026: a fresh named volume mounted at a path the image does NOT have is
# created by Docker as root:root drwxr-xr-x, and from this same image as uid 1001 a read
# passes while a write comes back "Permission denied". The deploy stacks mount a named
# volume exactly here, so without this line the stack comes up, the health check is green,
# every picture a row already describes is served - and the FIRST upload fails, at a place
# that has nothing to do with uploading.
#
# It has to be HERE rather than in compose, and before USER, because Docker copies an
# existing directory's content and its OWNERSHIP into a fresh volume; after USER this
# command could not chown anything, and in compose there is nothing that runs before the
# volume is laid down.
#
# The path is the one both deploy stacks hand the backend as BTL_PHOTOS_FOLDER, and
# WhatEachStackRequiresTest.theImageOwnsThatFolderBeforeItStopsBeingRoot reads it off the
# rendered configuration rather than out of this comment, so the day it moves this line is
# what goes red.
#
# THE FOLDER ITSELF AND NOT ITS PARENT, corrected 20.09.2026. `chown -R /var/lib/btl` did
# reach it, so nothing was broken; what it cost is that the Dockerfile and the stacks named
# two different paths, and a recursive chown of a parent goes on looking right on the day a
# stack moves its pictures somewhere that parent no longer contains. `/var/lib/btl` is left
# root-owned on purpose: the backend writes INSIDE this folder and only needs to traverse
# the one above it, which drwxr-xr-x already allows.
RUN mkdir -p /var/lib/btl/photos && chown -R btl:btl /var/lib/btl/photos
USER btl
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
