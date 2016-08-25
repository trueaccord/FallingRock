#!/bin/bash

cd /src
pm2 link $PM2SECRET $PM2PUBLIC
pm2 start -x server.js --no-daemon --name FallingRock -- -c /cfg/config.yaml
