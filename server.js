// MVC implementation based upon tutorial: https://www.youtube.com/watch?v=-RCnNyD0L-s


if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

class Server {
    constructor () {
        this._ready = false;
    }

    // Getters and setters
    set ready(value) {
        if (value) {
            util.log('Server initialized.');
        }
        this._ready = value;
    }
    get ready() {
        return this._ready;
    }
    
    // Waiting function until project is initiated with Projects and Templates
    waitUntilReady() {
        if (!this.ready) {
            let self = this;
            return new Promise(function (resolve, reject) {
                (function waitForReady(){
                    if (self.ready) return resolve('ready');
                    setTimeout(waitForReady, 5);
                })();
            });
        }
    }
}
let serverStatus = new Server();
let activeUsers = [];

const express = require('express');
const expressLayouts = require('express-ejs-layouts')
const fileUpload = require('express-fileupload');
const path = require("path");
const http = require('http');
const https = require('https');
const util = require('util');
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const config = require('./config.json');

// Configure passport
const initializePassport = require('./passport-config')
initializePassport(passport)

const indexRouter = require('./routes/index');
const userRouter = require('./routes/admin')

const mongoose = require('mongoose')

global.appRoot = path.resolve(__dirname);

const Project = require('./project.js');

// Configure the archive
const ARCHIVE_FOLDER = process.env.ARCHIVE_FOLDER;
const Archive = require('./archive.js');
const projectArchive = new Archive(ARCHIVE_FOLDER);

(async () => {
    try {
        await Project.initiateProjectArray();
        Project.watchFolder();
        serverStatus.ready = true;
    } catch(error) {
        util.log(`Error initiating server: ${error}`);
    }
})();

const Twitter = require('./twitter.js');
Twitter.initiateTwitter();

const fs = require('fs');
const Account = require('./models/account');

var accounts = {}

// //////////////// //
// HELPER FUNCTIONS //
// //////////////// //

// Remove an element from an array by value
function removeValueFromArray(array, value) {
    return array.filter(function(element) {
        return element != value;
    });
}

// ////// //
// SET-UP //
// ////// //

// Set-up MongooseDB
mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
const db = mongoose.connection
db.on('error', error => console.error(error))
db.once('open', () => util.log('Connected to Mongoose'))

const initMongoose = () => {
    const path = appRoot + '/.deploy/users.json';
    fs.readFile(path, 'utf8', function (err, data) {
        if (err) return;
        try {
            const usersConf = JSON.parse(data);
            usersConf.users.forEach(user => addUser(user));
        } catch (error) {
            util.log(`Error in users.json: ${error.message}.`);
            deleteUsers(path);            
        }
        deleteUsers(path);
    });
}

const addUser = (user) => {
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

const deleteUsers = (path) => {
    fs.unlink(path, (err) => {
        if (err) util.error(err.message)
    });
}

initMongoose();

// Set-up web server
var app = express();
app.use(express.static('public'));
app.use(fileUpload());
app.set('view-engine', 'ejs');
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

app.use(methodOverride('_method'))

let server;
if (process.env.SSL == 'true') {
    const credentials = {
        key: fs.readFileSync('./ssl/localhost-key.pem'),
        cert: fs.readFileSync('./ssl/localhost.pem')
    };
    server = https.createServer(credentials, app);
} else {
    server = http.createServer(app);
} 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.set('layout', 'layouts/layout');
app.use(expressLayouts);

app.use('/', indexRouter)
app.use('/admin', userRouter)

// Upload media file to presentation folder
app.post('/upload', async function(req, res) {
    if (!req.files || Object.keys(req.files).length === 0) {
        util.log(`No files were uploaded.`);
    }
    
    // The name of the input field (i.e. "newMedia") is used to retrieve the uploaded file(s)
    let uploadedFile = req.files.newMedia;

    // Retrieve the active session
    let activeSession = projectArray[req.body.userName];

    // Check if a single or multiple files were uploaded
    if (Array.isArray(uploadedFile)) {
        for (index = 0; index < uploadedFile.length; index++) { 
            await activeSession.saveMedia(uploadedFile[index]); 
        } 
    }
    else {
        await activeSession.saveMedia(uploadedFile);
    }

    // Accknowledge retrieval of upload
    res.status(204).send();
});

// Set-up Socket.io
//var io = socketio(server);
// TO DO - Made Socket.io global -- not a good practice, but good enough for now
global.io = require('socket.io')(server, {
    pingTimeout: 5000,
    pingInterval: 25000
});

var projectArray = {};
Project.userList = {};

io.on('connection', function(socket) {

    // New connection detected
    if (accounts[socket.id] == undefined) {
        util.log(`Unknown connection detected: ${socket.id}.`);
        io.to(socket.id).emit('whoAreYou');
    }

    // User registered
    socket.on('user', async function(idCard) {
        const previousSession = idCard.sessionId;
        try {
            // Add session to look-up table
            accounts[socket.id] = {};
            accounts[socket.id].active = true;
            accounts[socket.id].name = idCard.name;
            io.emit('sessionsUpdate', accounts);

            // Wait for server to finish initializing
            await serverStatus.waitUntilReady();

            // If user is not yet listed in look-up table, create a project
            if (projectArray[accounts[socket.id].name] == undefined) {
                projectArray[accounts[socket.id].name] = new Project();
                projectArray[accounts[socket.id].name].activeSession = idCard.name;
                // Check if user was working on a project
                if (idCard.project) {
                    projectArray[accounts[socket.id].name].name = idCard.project;
                    await projectArray[accounts[socket.id].name].read();
                }
                util.log(`New user session created for ${idCard.name}. Current number of users: ${Object.keys(projectArray).length}.`);
            };

            // Add session to socket.io room
            socket.join(idCard.name);

            if (activeUsers.indexOf(idCard.name) == -1) {
                activeUsers.push(idCard.name);
                // Keep track of active users
                io.emit('usersUpdate', activeUsers);
            } else {
                io.to(socket.id).emit('usersUpdate', activeUsers);
            }

            // Send status to client
            Project.sendProjectsUpdate();
            projectArray[accounts[socket.id].name].sendStatus();

            Project.addUser(accounts[socket.id].name, idCard.project);
            Project.getUserList();

            if (idCard.project) {
                util.log(`User connected: ${idCard.name} (${socket.id}). Reconnected to ${idCard.project}.`);
            } else {
                util.log(`User connected: ${idCard.name} (${socket.id}).`);
            }
        } catch(error) {
            util.log(`Error during logging in of user: ${error}`);
        }
    });
    
    // Session disconnected
    socket.on('disconnect', function(reason) {
        let userName = '';
        if (accounts[socket.id]) {
            userName = accounts[socket.id].name;
            delete accounts[socket.id];

            // Delete entry from projectArray when user is gone
            if (Object.keys(accounts).find(key => accounts[key].name === userName) === undefined) {
                // DANGER !!!!!
                Project.removeUser(userName, projectArray[userName].name);
                Project.getUserList();
                Project.unLock(userName);
                delete projectArray[userName];
                util.log(`User ${userName} logged off. Current number of users: ${Object.keys(projectArray).length}.`);
                // Keep track of active users
                activeUsers = removeValueFromArray(activeUsers, userName);
                io.emit('usersUpdate', activeUsers);
            }

            // Send update to Admin panel
            io.emit('sessionsUpdate', accounts);

            util.log(`User session disconnected (${reason}): ${userName} (${socket.id}).`);
        } else {
            util.log('Error: Unregistered user disconnect detected...');
        }
    });

    // List all sessions
    socket.on('getSessions', function() {
        io.emit('sessionsUpdate', accounts);
    });

    // Synchronise templates
    socket.on('importTemplates', async () => {
        await Project.importTemplates();
    });

    // Client asks for project
	socket.on('changeProject', function(projectName) {
        try {
            if (projectArray[accounts[socket.id].name]) {
                Project.removeUser(accounts[socket.id].name, projectArray[accounts[socket.id].name].name);
            }
            projectArray[accounts[socket.id].name].name = projectName;
            projectArray[accounts[socket.id].name].read();
            Project.addUser(accounts[socket.id].name, projectName);
            Project.getUserList();
        } catch(error) {
            util.log(`Error during change of project: ${error}`);
        }
    });

    // Client wants to create a new project
    socket.on('createProject', function() {
        try {
            if (projectArray[accounts[socket.id].name]) {
                Project.removeUser(accounts[socket.id].name, projectArray[accounts[socket.id].name].name);
            }
            projectArray[accounts[socket.id].name].create(accounts[socket.id].name);
        } catch(error) {
            util.log(`Error during creation of project: ${error}`);
        }
    });

    // Client wants to rename a project
    socket.on('changeSettings', function(settings) {
        try {
            projectArray[accounts[socket.id].name].changeSettings(settings);
        } catch(error) {
            util.log(`Error during renaming of project: ${error}`);
        }        
    });

    // Client asks for info about a particular page
	socket.on('triggerPage', function(pageId) {
        try {
            projectArray[accounts[socket.id].name].triggerPage(pageId);
        } catch(error) {
            util.log(`Error during tiggering of page: ${error}`);
        }  
    });

	// Client asks for complete XML data
	socket.on('getXml', function() {
        try {
            projectArray[accounts[socket.id].name].sendXml(socket.id);
        } catch(error) {
            util.log(`Error during getting of XML: ${error}`);
        }             
    });

    // Client saves page data (including assets)
	socket.on('savePage', function(page, id, snapShot) {
        try {
            projectArray[accounts[socket.id].name].savePage(page, id);
        } catch(error) {
            util.log(`Error during saving of page: ${error}`);
        }   
    });

    // Client saves XML data
	socket.on('saveXml', function(page) {
        try {
            projectArray[accounts[socket.id].name].saveXml(page);
        } catch(error) {
            util.log(`Error during saving of XML: ${error}`);
        }   
    });

    // Client swaps pages
	socket.on('swapPage', function(pageId1, pageId2) {
        try {
            projectArray[accounts[socket.id].name].swapPage(pageId1, pageId2);
        } catch(error) {
            util.log(`Error during swapping of pages: ${error}`);
        }   
    });

        // Client swaps pages
	socket.on('movePage', function(pageId1, pageId2) {
        try {
            projectArray[accounts[socket.id].name].movePage(pageId1, pageId2);
        } catch(error) {
            util.log(`Error during moving of pages: ${error}`);
        }   
    });

    // Client deletes page
	socket.on('deletePage', function(pageId) {
        try {
            projectArray[accounts[socket.id].name].deletePage(pageId);
        } catch(error) {
            util.log(`Error during deleting of page: ${error}`);
        } 
    });

    // Client deletes media
	socket.on('deleteMedia', function(media) {
        try {
            projectArray[accounts[socket.id].name].deleteMedia(media);
        } catch(error) {
            util.log(`Error during deleting of media: ${error}`);
        } 
    });

    // Client removes all unused media
	socket.on('cleanOutMedia', function() {
        try {
            projectArray[accounts[socket.id].name].cleanOutMedia();
        } catch(error) {
            util.log(`Error during cleaning out of media: ${error}`);
        } 
    });
    
    // Client consolidates media from dropfolder
	socket.on('reloadOtto', function() {
        try {
            projectArray[accounts[socket.id].name].reloadOtto();
        } catch(error) {
            util.log(`Error during realoading of Otto-folder: ${error}`);
        } 
    });

    // Client consolidates media from dropfolder
	socket.on('consolidateMedia', function(media) {
        try {
            projectArray[accounts[socket.id].name].consolidateMedia(media);
        } catch(error) {
            util.log(`Error during consolidation of media: ${error}`);
        } 
    });

    // Client sends screenshot
    socket.on('saveScreenShot', function(id, data) {
        try {
            projectArray[accounts[socket.id].name].saveScreenShot(id, data);
        } catch(error) {
            util.log(`Error during saving of screenshot: ${error}`);
        } 
    });

    // Client wants to sync with remote server
    socket.on('syncProject', function(target) {
        try {
            projectArray[accounts[socket.id].name].sync(target);
        } catch(error) {
            util.log(`Error during syncing of ${target}: ${error}`);
        } 
    });

    socket.on('archiveProject', (projectName) => {
        projectArchive.export(projectName);
    });

    socket.on('getPlayerList', () => {
        const players = Project.listTargets();
        io.emit('playerList', players);
    });

    socket.on('getArchiveList', () => {
        io.emit('archiveList', projectArchive.projectsList);
    });

    socket.on('importProject', (projectName) => {
        projectArchive.import(projectName);
    });

    // Get tweet
    socket.on('getTweet', async function(url) {
        try {
            const tweet = new Twitter();
            tweet.mediaLocation = projectArray[accounts[socket.id].name].mediaLocation();
            const tweetBody = await tweet.getTweet(url);
            await projectArray[accounts[socket.id].name].listMedia();
            projectArray[accounts[socket.id].name].sendMediaStatus();
            io.to(socket.id).emit('tweet', tweetBody);
        } catch(error) {
            util.log(`Error during retrieval of tweet: ${error}`);
        } 
    });

    // Messages to be sent to TouchDesigner
    socket.on('sendToTouch', function(command, target = null) {
        if (target) {
            touch.init(target, config.syncTargets[target].url, config.syncTargets[target].port);
            util.log(`Sending ${command} to ${target} TouchDesigner (${config.syncTargets[target].url}:${config.syncTargets[target].port}).`);
        } else {
            util.log(`Sending ${command} to TouchDesigner.`);
        }
        touch.sendCommand(command);
    });

    socket.on('touchDesignerStatus', function() {
        touch.sendStatus();
    });

    socket.on('TD_project', function(project) {
        touch.changeProject(project);
    });

    socket.on('TD_container', function(page, transition) {
        touch.switchPage(page, transition);
    });

    socket.on('TD_asset', function(asset) {
        touch.clickAsset(asset);
    });
});

server.listen(process.env.PORT || 3000, function () {
    util.log('Listening on *:' + (process.env.PORT || 3000));
});

// TouchDesigner connection
// ========================
const TouchDesigner = require('./touchdesigner.js');
const touch = new TouchDesigner();
touch.on('connected', () => {
    io.emit('connected');
    util.log('Connected to TouchDesigner.');
});
touch.on('disconnected', () => {
    io.emit('disconnected');
    util.log('Disconnected from TouchDesigner.');
});
touch.on('projects', (projects) => {
    io.emit('projects', projects);
});
