const Role = require('../models/role.model');
const Account = require('../models/account-model');
const util = require('util');
const passport = require('passport');
const jwt = require("jwt-simple");

createUser = (req, res) => {
    const { username, email, password } = req.body;

    // Check required fields
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Niet alle velden zijn ingevuld: username, email en password" });
    }

    // Process request
    Account.findOne({
        $or: [{ email: email }, { username: username }]
    }).then((user) => {
        // Username is already in use
        if (user && user.username == username) return res.status(400).json({ message: `De gebruikersnaam ${username} is reeds in gebruik` });

        // Email is already in use
        if (user && user.email == email) return res.status(400).json({ message: `Het e-mailadres ${email} is reeds in gebruik` });

        // Create new user
        const newUser = new Account({
            username: username,
            name: username,
            role: "1",
            email: email
        });

        // Register user
        Account.register(newUser, password, (error) => {
            if (error) {
                res.status(500).send({ message: error });
                return;
            }
            if (req.body.roles) {
                Role.find(
                    {
                        name: { $in: req.body.roles }
                    },
                    (err, roles) => {
                        if (err) {
                            res.status(500).send({ message: err });
                            return;
                        }
                        newUser.roles = roles.map(role => role._id);
                        if (newUser.roles.includes('admin')) {
                            newUser.role = '0';
                        }
                        newUser.save((err, returnedAccount) => {
                            if (err) {
                                res.status(500).send({ message: err });
                                return;
                            }
                            res.send({ data: returnedAccount, message: "Gebruiker succesvol aangemaakt" });
                        });
                    }
                );
            } else {
                Role.findOne({ name: "user" }, (err, role) => {
                    if (err) {
                        res.status(500).send({ message: err });
                        return;
                    }
                    newUser.roles = [role._id];
                    newUser.save((err, returnedAccount) => {
                        if (err) {
                            res.status(500).send({ message: err });
                            return;
                        }
                        res.send({ data: returnedAccount, message: "Gebruiker succesvol aangemaakt" });
                    });
                });
            }
        });
    });
}

loginUser = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (info) {
            if (info.name == 'IncorrectUsernameError') {
                return res.status(401).json({ message: "Foutieve gebruikersnaam" });
            } else if (info.name == 'IncorrectPasswordError') {
                return res.status(401).json({ message: "Foutief paswoord" });
            } else {
                return res.status(401).json({ message: err.message });
            }
        }
        if (err) {
            return res.status(500).json({ message: "error", error: err });
        }
        if (!user) {
            return res.status(401).json({ message: "Gebruiker niet gevonden" });
        }
        req.login(user, (err) => {
            if (err) { 
                return res.status(500).json({ message: "Kan gebruiker niet inloggen", error: err });
            };
            let payload = {
                id: user.id,
                expire: Date.now() + 1000 * 60 * 60 * 24    // 1 day
            }
            const token = jwt.encode(payload, process.env.SESSION_SECRET);
            return res.status(200).json({ 
                id: user._id,
                username: user.username,
                email: user.email,
                token: token,
                tokenExpires: payload.expire,
                message: "Toegang verleend"
            });
        });
    })(req, res, next);
}

logoutUser = (req, res) => {
    req.logout();
    return res.status(200).json({ message: "Gebruiker succesvol uitgelogd" });
}

loginChecker = (req, res) => {
    if (req.isAuthenticated()) {
        return res.status(200).json({ message: "Gebruiker is succesvol ingelogd" });
    } else {
        return res.status(401).json({ message: "Geen toegang" });
    }
};

getUserList = (req, res) => {
    // if (!req.isAuthenticated()) {
    //     return res.status(401).json({ message: "Geen toegang" });
    // }
    Account.find({})
        .populate("roles", "-__v")
        .exec((error, users) => {
            if (error) {
                return res.status(500).json({ message: error });
            }
            if (!users.length) {
                return res.status(500).json({ message: "Geen gebruikers gevonden" });
            }
            const data = users.map(user => ({
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles.map(role => role.name)
            }));
            return res.status(200).json({ data: data, message: "Gebruikerslijst succesvol opgehaald" });
        });
}

getUserById = (req, res) => {
    Account.findOne({ _id: req.params.id })
        .populate("roles", "-__v")
        .exec((error, user) => {
            if (error) {
                return res.status(500).json({ message: "Probleem met databank", error: error });
            }
            if (!user) {
                return res.status(400).json({ message: "Gebruiker niet gevonden" });
            }
            const data = {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles.map(role => role.name)
            }
            return res.status(200).json({ data: data, message: "Gebruikersdata succesvol verzonden" });
        }
        )
}

updateUser = (req, res) => {
    const body = req.body;

    if (!body.username && !body.email && !body.password && !body.roles) {
        return res.status(400).json({ message: "Geen geldig veld opgegeven: username, email, roles of password" })
    }

    Account.findOne({ _id: req.params.id }, async (error, user) => {
        // Database error
        if (error) {
            return res.status(500).json({ message: "Probleem met database", error: error });
        }

        // User not found
        if (!user) {
            return res.status(404).json({ message: "Gebruiker niet gevonden" })
        }

        // Updating the user data
        if (body.username) {
            user.username = body.username;
        }
        if (body.email) {
            user.email = body.email;
        }
        if (body.roles) {

            // Legacy code to get the correct role number 0 or 1
            user.role = '1';
            
            await Role.find(
                {
                    name: { $in: body.roles }
                },
                (error, roles) => {
                    if (error) {
                        return res.status(500).send({ message: error });
                    }
                    user.roles = roles.map(role => role._id);

                    // Legacy code to get the correct role number 0 or 1
                    if (roles.map(role => role.name).includes('admin')) {
                        user.role = '0';
                    }

                })
                .clone()
                .catch(error => {
                    return res.status(500).send({ message: error });
                });
        }
        if (body.password) {
            await user.setPassword(body.password);
        }

        // Save updated user data
        user.save((error, returnedAccount) => {
            if (error) {
                res.status(500).send({ message: error });
                return;
            }
            const data = {
                id: returnedAccount._id,
                username: returnedAccount.username,
                email: returnedAccount.email,
                roles: returnedAccount.roles
            }
            res.status(200).send({ data: data, message: "Gebruiker succesvol aangepast" });
        });
    });
}

deleteUser = (req, res) => {
    Account.findOneAndDelete({ _id: req.params.id }, (error, user) => {
        if (error) {
            return res.status(500).json({ message: error });
        }
        if (!user) {
            return res.status(404).json({ message: "Gebruiker niet gevonden" });
        }
        return res.status(200).json({ message: "Gebruiker succesvol verwijderd" });
    });
}

cleanUp = async (req, res) => {
    let rolesArray = {};
    let updatedUsers = [];
    await Role.find({}, (error, roles) => {
        if (error) {
            res.status(500).send({ message: error });
            return;
        }
        roles.map(role => { rolesArray[role.name] = role._id });
    }).clone();
    Account.find({})
        .populate("roles", "-__v")
        .exec(async (error, users) => {
            if (error) {
                res.status(500).json({ message: "Database error", error: error });
            }
            for (let i in users) {
                let updated = false;

                // Legacy code - based upon users role number, an array of roles if filled.
                if (!users[i].roles.length) {
                    const newRoles = (users[i].role == '0' ? [rolesArray['user'], rolesArray['admin']] : rolesArray['user']);
                    users[i].roles = newRoles;
                    updated = true;
                }
                
                if (!users[i].email) {
                    users[i].email = users[i].username;
                    users[i].username = users[i].name;
                    updated = true;
                }
                if (updated) {
                    updatedUsers.push(users[i].username);
                    users[i].save((err, returnedAccount) => {
                        if (err) {
                            res.status(500).send({ message: err });
                            return;
                        }
                    });
                }
            }
            util.log('Cleaned user database');
            res.status(200).json({ message: "Cleaned database", users: updatedUsers });
        });
}

module.exports = {
    createUser,
    loginUser,
    logoutUser,
    loginChecker,
    getUserById,
    updateUser,
    getUserList,
    deleteUser,
    cleanUp
}