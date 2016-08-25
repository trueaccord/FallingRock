FROM node:argon

RUN mkdir -p /src
WORKDIR /src
COPY package.json /src/
RUN npm install
RUN npm install -g pm2

COPY *.js *.sh /src/
RUN chmod 755 /src/startPM2.sh
ENTRYPOINT ["/src/startPM2.sh"]

EXPOSE 1389
