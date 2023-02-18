const express = require('express');
const router = express.Router();
const passport = require('passport');
const Account = require('../models/account-model');

// Middleware function to make sure user is authenticated
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Middleware function to make sure user is not authenticated
function checkNotAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

router.get('/', checkAuthenticated, (req, res) => {
    let locals = {
        title: 'VRT Touch - Editor',
        name: req.user.name,
        role: req.user.role,
        username: req.user.username,
        email: req.user.email,
    };
    res.render('index', locals);
});

router.get('/login', checkNotAuthenticated, (req, res) => {
    let locals = {
        title: 'VRT Touch - Login',
        stylesheet: 'login.css'
    };
    res.render('login', locals);
});

router.post('/login', checkNotAuthenticated, passport.authenticate('local', { 
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

router.get('/profile', checkAuthenticated, (req, res) => {
    let locals = {
        title: 'VRT Touch - Editor',
        stylesheet: 'login.css', 
        user: req.user,
        errorMessage: ''
    };
    res.render('profile', locals);
});

router.get('/facebook', function(req, res) {
    const projectName = (req.query.name ? req.query.name : 'None');
    let locals = {
        title: 'VRT Touch - Facebook',
        name: 'anonymous',
        role: 1,
        username: 'anonyomous',
        projectName: projectName,
        code: req.query.code
    };
    console.log(req.query.code);
    res.render('facebook', locals);
});

router.post('/profile', checkAuthenticated, function(req, res) {
    // Find current user in the database
    let newUsername = null;
    Account.findOne({ username: req.user.username }, (err, user) => {
        if (req.body.username && req.user.username != req.body.username) {
            console.log(user.username + " " + req.body.username);
            newUsername = req.body.username;
        };
        if (!(req.body.passwordNew1 && req.body.passwordNew2)) {
            req.body.passwordNew1 = req.body.password;
            req.body.passwordNew2 = req.body.password;
        }
        // Check if error connecting
        if (err) {
            res.render('profile', { 
                user: req.user, 
                title: 'VRT Touch - Editor',
                stylesheet: 'login.css', 
                errorMessage: 'Verbindingsfout. Probeer later opnieuw.' });
        } else {
            // Check if user was found in database
            if (!user) {
                res.render('profile', { 
                    user: req.user, 
                    title: 'VRT Touch - Editor',
                    stylesheet: 'login.css', 
                    errorMessage: 'Gebruiker onbekend.' });
            } else {
                // Check if new passwords match
                if (req.body.passwordNew1 != req.body.passwordNew2) {
                    res.render('profile', { 
                        user: req.user, 
                        title: 'VRT Touch - Editor',
                        stylesheet: 'login.css', 
                        errorMessage: 'Paswoorden komen niet overeen.' });
                } else {
                    user.changePassword(req.body.password, req.body.passwordNew1, function(err) {
                        if (err) {
                            if (err.name === "IncorrectPasswordError") {
                                res.render("profile", {
                                    user: req.user,
                                    title: "VRT Touch - Editor",
                                    stylesheet: "login.css",
                                    errorMessage: "Foutief paswoord.",
                                });
                            } else {
                                res.render("profile", {
                                    user: req.user,
                                    title: "VRT Touch - Editor",
                                    stylesheet: "login.css",
                                    errorMessage:
                                        "Nog onbekende fout. Contacteer de administrator.",
                                });
                            }
                        } else {
                            if (newUsername) {
                                user.username = newUsername;
                                user.save((error) => {
                                    if (error) {
                                        res.render("profile", {
                                            user: req.user,
                                            title: "VRT Touch - Editor",
                                            stylesheet: "login.css",
                                            errorMessage: "Foutief paswoord.",
                                        });
                                    } else {
                                        res.redirect("/");
                                    }
                                });
                            } else {
                                res.redirect("/");
                            }
                        }
                    });
                }
            }
        }
    });   
});

router.get('/logout', checkAuthenticated, function(req, res) {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/login');
    });
});

router.get('/help', checkAuthenticated, function(req, res) {
    let locals = {
        title: 'VRT Touch - Help',
        name: req.user.name,
        role: req.user.role,
        username: req.user.username
    };
    res.render('help', locals);
});

router.get('/player', function(req, res) {
    const projectName = (req.query.name ? req.query.name : 'None');
    let locals = {
        title: 'VRT Touch - Player',
        name: 'anonymous',
        role: 1,
        username: 'anonyomous',
        projectName: projectName
    };
    res.render('player', locals);
});

router.get('/ping', function(req, res){
    res.status(200).send("pong!");
});

module.exports = router;