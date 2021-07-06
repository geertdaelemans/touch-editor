const LocalStrategy = require('passport-local').Strategy
const Account = require('./models/account')

function initialize(passport) {
    passport.use(new LocalStrategy({ usernameField: 'username' }, Account.authenticate()))
    passport.serializeUser(Account.serializeUser())
    passport.deserializeUser(Account.deserializeUser())
}

module.exports = initialize