const express = require('express');
const router = express.Router();
const passport = require('passport');
const Account = require('../models/account');

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

// Middleware function to convert submitted username to lower case
function usernameToLowerCase(req, res, next) {
    req.body.username = req.body.username.toLowerCase();
    next();
}

router.get('/', checkAuthenticated, (req, res) => {
    let locals = {
        title: 'VRT Touch - Editor',
        name: req.user.name,
        role: req.user.role,
        username: req.user.username
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

router.post('/login', checkNotAuthenticated, usernameToLowerCase, passport.authenticate('local', { 
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

router.post('/profile', checkAuthenticated, function(req, res) {
    // Find current user in the database
    Account.findOne({ username: req.body.username }, (err, user) => {
        if (req.user.name != req.body.name && req.body.name) {
            console.log(user.name + " " + req.body.name);
            user.name = req.body.name;
        };
        if (!(req.body.passwordNew1 && req.body.passwordNew2)) {
            req.body.passwordNew1 = req.body.password;
            req.body.passwordNew2 = req.body.password;
        }
        // Check if error connecting
        if (err) {
            res.render('profile', { user: req.user, errorMessage: 'Verbindingsfout. Probeer later opnieuw.' });
        } else {
            // Check if user was found in database
            if (!user) {
                res.render('profile', { user: req.user, errorMessage: 'Gebruiker onbekend.' });
            } else {
                // Check if new passwords match
                if (req.body.passwordNew1 != req.body.passwordNew2) {
                    res.render('profile', { user: req.user, errorMessage: 'Paswoorden komen niet overeen.' });
                } else {
                    user.changePassword(req.body.password, req.body.passwordNew1, function(err) {
                        if(err) {
                            if(err.name === 'IncorrectPasswordError'){
                                res.render('profile', { user: req.user, errorMessage: 'Foutief paswoord.' });
                            }else {
                                res.render('profile', { user: req.user, errorMessage: 'Nog onbekende fout. Contacteer de administrator.' });
                            }
                        } else {
                            res.redirect('/');
                        }
                    });
                }
            }
        }
    });   
});

router.get('/logout', checkAuthenticated, function(req, res) {
    req.logout();
    res.redirect('/login');
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