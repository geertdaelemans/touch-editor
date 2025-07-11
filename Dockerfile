FROM node:16

# Create app directory
WORKDIR /usr/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Install ffmpeg
RUN apt-get update && apt-get install ffmpeg -y

# Bundle app source
COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]
