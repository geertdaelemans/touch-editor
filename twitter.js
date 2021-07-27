#!/usr/bin/env node
/*
Moderating script for tweets

By Geert Daelemans
*/

const twitter = require('twit');
const request = require('request');
const path = require('path');
const fs = require('fs-extra');

class Twitter {
    constructor() {
        this._mediaLocation = '';
        this._jsonData = {};
        this._media = [];
        this._localMedia = [];
    }

    // Getters and setters
    set mediaLocation(value) {
        this._mediaLocation = value;
    }
    get mediaLocation() {
        return this._mediaLocation;
    }
    set jsonData(value) {
        this._jsonData = value;
    }
    get jsonData() {
        return this._jsonData;
    }
    set media(value) {
        this._media = value;
    }
    get media() {
        return this._media;
    }
    set localMedia(value) {
        this._localMedia = value;
    }
    get localMedia() {
        return this._localMedia;
    }

    // Authorise Twitter application
    static initiateTwitter() {
        Twitter.client = new twitter({
            consumer_key:           process.env.TWITTER_CONSUMER_KEY,
            consumer_secret:        process.env.TWITTER_CONSUMER_SECRET,
            access_token:           process.env.TWITTER_ACCESS_TOKEN,
            access_token_secret:    process.env.TWITTER_ACCESS_TOKEN_SECRET  
        });
    }

    // List all available media and stores the file names in an array
    listMedia() {
        // Make distiction between trucated or not trucated tweet
        let extractedMedia = [];
        if (this.jsonData.extended_entities) {
            extractedMedia = this.jsonData.extended_entities.media;
        } else if (this.jsonData.entities) {
            extractedMedia = this.jsonData.entities.media;
        }
        this.media = [];
        for (let i in extractedMedia) {
            this.media.push(extractedMedia[i].media_url);
        }
        return this.media.length;
    }

    // Saving profile image
    // This function returns a promise
    async saveProfileImage() {
        const fileName = `twitter_${this.jsonData.user.screen_name}${path.extname(this.jsonData.user.profile_image_url)}`;
        this.jsonData.user.local_copy_image = fileName;
        const filePath = this.mediaLocation + '\\' + fileName;
        return new Promise((resolve, reject) => {
            request(this.jsonData.user.profile_image_url.replace('normal', '400x400'))
            .pipe(fs.createWriteStream(filePath))
            .on('finish', () => resolve())
            .on('error', error => reject(error));
        });
    }

    // Saving profile image
    // This function returns a promise
    async saveAllMedia() {
        let promises = [];
        this.localMedia = [];
        for (var i in this.media) {
            const fileName = `twitter_media_${path.basename(this.media[i])}`;
            this.localMedia.push(fileName);
            const filePath = this.mediaLocation + '\\' + fileName;
            promises.push(new Promise((resolve, reject) => {
                request(this.media[i])
                .pipe(fs.createWriteStream(filePath))
                .on('finish', () => resolve())
                .on('error', error => reject(error));
            }));
        }
        return Promise.all(promises);
    }

    // Get tweet based upon the given URL
    // This function returns a promise
    async getTweet(link) {
        const url = new URL(link);
        const path = url.pathname.split('/');
        const id = path[path.length - 1];
        const self = this;
        return new Promise((resolve, reject) => {
            Twitter.client.get('statuses/show/:id', { id: id, tweet_mode: 'extended' }, async function(error, data, response) {
                if (error) reject(error);
                self.jsonData = data;
                if (self.jsonData.full_text) {
                    self.jsonData.text = self.jsonData.full_text;
                }
                self.jsonData.link = link;
                self.jsonData.text = self.jsonData.text.replace(/http\S+/g, '');
                await self.saveProfileImage();
                if (self.listMedia()) {
                    await self.saveAllMedia();
                    self.jsonData.local_media = self.localMedia;
                }
                resolve(self.jsonData);
            });  
        });      
    }
}

module.exports = Twitter;