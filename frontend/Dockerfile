FROM node:18-alpine

# Needed for some npm packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only package files first (important for caching)
COPY package.json package-lock.json ./

RUN npm install --legacy-peer-deps --verbose

# Copy rest AFTER install
COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
