var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var passportLocalMongoose = require('passport-local-mongoose');

var Account = new Schema({
    username: String,
    email: String,
    password: String,
    name: {
        type: String,
        required: false,
    },
    role: {
        type: String,
        required: false
    },
    roles: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role"
        }
    ],
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
});

Account.plugin(passportLocalMongoose, 
    { 
        usernameQueryFields: ['username', 'email'], 
        usernameCaseInsensitive: true
    });

module.exports = mongoose.model('Account', Account);