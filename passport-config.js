const LocalStrategy = require('passport-local').Strategy
const Account = require('./models/account-model')

function initialize(passport) {
    passport.use(new LocalStrategy({ usernameField: 'username' }, Account.authenticate()))
    passport.serializeUser(Account.serializeUser())
    passport.deserializeUser(Account.deserializeUser())
}

module.exports = initialize