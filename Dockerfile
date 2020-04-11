FROM node:10.16.3 AS builder

RUN mkdir /app
WORKDIR /app

# cache this layer
RUN npm install web3 bignumber.js console-stamp node-fetch 

COPY . /app

RUN npm install

ENV KEYSTORE=${KEYSTORE}
ENV PASSWORD=${PASSWORD}
ENV RPC=${RPC}
ENV AMM=${AMM}
CMD [ "sh", "-c", "node update_index.js --keystore=\"${KEYSTORE}\" --password=\"${PASSWORD}\" --rpc=\"${RPC}\" --amm=\"${AMM}\"" ]

