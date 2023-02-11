#!/usr/bin/env node
/*
Moderating script for tweets

By Geert Daelemans
*/

const { TwitterApi } = require('twitter-api-v2');
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
    static async initiateTwitter() {
        const consumerClient = new TwitterApi({ 
            appKey:                 process.env.TWITTER_CONSUMER_KEY, 
            appSecret:              process.env.TWITTER_CONSUMER_SECRET,
            accessToken:            process.env.TWITTER_ACCESS_TOKEN,
            accessSecret:           process.env.TWITTER_ACCESS_TOKEN_SECRET
         });
        // Obtain app-only client
        Twitter.client = await consumerClient.appLogin();
    }

    // List all available media and stores the file names in an array
    listMedia() {
        this.media = [];
        if (this.jsonData.includes && this.jsonData.includes.media) {
            this.jsonData.includes.media.forEach(element => {
                if (element.type == 'photo' && element.url) {
                    this.media.push(element.url);
                }
            });
        }
        return this.media.length;
    }

    // Saving profile image
    // This function returns a promise
    async saveProfileImage() {
        if (this.jsonData.user.name && this.jsonData.user.profile_image_url) {
            const fileName = `twitter_${this.jsonData.user.name}${path.extname(this.jsonData.user.profile_image_url)}`;
            this.jsonData.user.local_copy_image = fileName;
            const filePath = this.mediaLocation + '\\' + fileName;
            return new Promise((resolve, reject) => {
                request(this.jsonData.user.profile_image_url.replace('normal', '400x400'))
                .pipe(fs.createWriteStream(filePath))
                .on('finish', () => resolve())
                .on('error', error => reject(error));
            });
        }
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
        return new Promise(async (resolve, reject) => {
            try {
                self.jsonData = await Twitter.client.v2.singleTweet(id, {
                    'tweet.fields': [
                        'public_metrics',
                        'created_at'
                    ],
                    expansions: [
                        'attachments.media_keys',
                        'author_id'
                    ],
                    'media.fields': [
                        'media_key',
                        'url'    
                    ],
                    'user.fields': [
                        'profile_image_url'
                    ]
                });                  
            } catch (error) {
                console.log(error.message);
                return;
            }

            // When the tweet is not found, report error and skip the rest
            if (self.jsonData.errors) {
                console.log(self.jsonData.errors[0].detail);
                return;
            }
            
            // Reformat the JSON data so that it makes sense to the parser
            self.jsonData.link = link;
            if (self.jsonData.data) {
                self.jsonData.text = (self.jsonData.data.text ? self.jsonData.data.text.replace(/http\S+/g, '') : "Geen tekst gevonden");
                self.jsonData.retweet_count = (self.jsonData.data.public_metrics.retweet_count ? self.jsonData.data.public_metrics.retweet_count : 0);
                self.jsonData.favorite_count = (self.jsonData.data.public_metrics.like_count ? self.jsonData.data.public_metrics.like_count : 0);
                self.jsonData.created_at = (self.jsonData.data.created_at ? self.jsonData.data.created_at : '0000-00-00');
            }
            if (self.jsonData.includes.users) {
                self.jsonData.user = self.jsonData.includes.users[0];
                self.jsonData.user.screen_name = (self.jsonData.user.username ? self.jsonData.user.username : "Geen userbame");
            }
            await self.saveProfileImage();
            if (self.listMedia()) {
                await self.saveAllMedia();
                self.jsonData.local_media = self.localMedia;
            }
            resolve(self.jsonData);
        });   
    }
}

module.exports = Twitter;