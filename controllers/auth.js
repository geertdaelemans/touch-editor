const passport = require("passport");
const passportJWT = require("passport-jwt");
const Account = require('../models/account-model');
const ExtractJwt = passportJWT.ExtractJwt;
const Strategy = passportJWT.Strategy;
const params = {
    secretOrKey: process.env.SESSION_SECRET,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken("jwt")
};

module.exports = function () {
    const strategy = new Strategy(params, function (payload, done) {
        Account.findById(payload.id, function (err, user) {
            if (err) {
                return done(null, false, { message: "Gebruiker bestaat niet." });
            } else if (payload.expire <= Date.now()) {
                // return done(new Error("TokenExpired"), null);
                return done(null, false, { message: "Sessie verlopen. Log opnieuw in." });
            } else {
                return done(null, user);
            }
        });
    });
    passport.use(strategy);
    return {
        initialize: function () {
            return passport.initialize();
        },
        authenticate: function () {
            return passport.authenticate("jwt", true); // false -> jwt session
        }
    };
};