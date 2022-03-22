var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var passportLocalMongoose = require('passport-local-mongoose');

var Account = new Schema({
    username: String,
    password: String,
    name: {
        type: String,
        required: true,
    },
    role: {
        // type: mongoose.Schema.Types.ObjectId,
        type: String,
        required: true
        // ref: 'Role'
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
});

Account.plugin(passportLocalMongoose);

module.exports = mongoose.model('Account', Account);