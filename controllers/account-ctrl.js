const Account = require('../models/account-model.js');
const util = require('util');

addUser = (user) => {
    const account = new Account({
        username: user.username.toLowerCase(),
        name: user.name,
        role: user.role
    });
    Account.register(account, user.password, function(err, returnedAccount) {
        if (err) console.error(err.message);
    });
    util.log('Default user(s) added.');
}

module.exports = {
    addUser
}