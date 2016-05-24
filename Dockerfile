FROM drjcfitz/rwys-scrape

WORKDIR /var/www

COPY package.json .
COPY ./cron/ ./cron
COPY ./db/ ./db

RUN npm install

ENTRYPOINT node /var/www/cron/rwysStatus.js
