const express = require('express')
const router = express.Router()
const passport = require('passport')
const util = require('util')

const Account = require('../models/account-model')
const Roles =
    [
        {
            name: 'Administrator',
            id: 0
        }, 
        {
            name: 'Editor',
            id: 1
        }
    ]

// Middleware function to make sure user is authenticated
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// All Users Route
router.get('/', checkAuthenticated, async (req, res) => {
    let locals = {
        title: 'VRT Touch - Control panel',
        name: req.user.username,
        username: req.user.username
    }; 
    res.render('admin/controller', locals);
});

router.get('/users', checkAuthenticated, async (req, res) => {
    let searchOptions = {};
    if (req.query.name != null && req.query.name !== '') {
        searchOptions.name = new RegExp(req.query.name, 'i')
    }
    try {
        const users = await Account.find(searchOptions);
        let locals = {
            title: 'VRT Touch - Admin',
            users: users,
            searchOptions: req.query,
            name: req.user.username,
            username: req.user.username
        }; 
        res.render('admin/users', locals);
    } catch (error) {
        res.redirect('/');
    }
});

router.get('/register', checkAuthenticated, function(req, res) {
    let locals = {
        title: 'VRT Touch - Admin',
        account: new Account(),
        password: '',
        roles: Roles
    };
    res.render('admin/new', locals);
})

router.post('/register', checkAuthenticated, async function(req, res) {
    const account = new Account({
        username: req.body.username,
        name: req.body.username,
        email: req.body.email,
        role: req.body.role
    })
    Account.register(account, req.body.password, function(err, returnedAccount) {
        if (err) {
            util.log(err.message);
            let locals = {
                title: 'VRT Touch - Admin', 
                account: account,
                password: req.body.password,
                roles: Roles,
                errorMessage: err.message
            };
            return res.render('admin/new', locals);
        }
        passport.authenticate('local', { 
            successRedirect: '/admin',
            failureRedirect: '/admin/register',
            failureFlash: true
        }) (req, res, function () {
            res.redirect('/');
        });
    });
});

router.get('/sessions', checkAuthenticated, function(req, res) {
    let locals = {
        title: 'VRT Touch - Admin',
    };
    res.render('admin/sessions', locals);    
});

router.get('/controller', checkAuthenticated, function(req, res) {
    let locals = {
        title: 'VRT Touch - Remote Controller',
        username: req.user.username
    };
    res.render('admin/controller', locals);    
});

module.exports = router