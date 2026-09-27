FROM node:20-alpine

# Prisma's engines need OpenSSL, which Alpine doesn't include by default
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || true) && npm run dev"]