
const convert = require('xml-js');
const util = require('util');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(appRoot + "/ffmpeg/ffmpeg.exe");
ffmpeg.setFfprobePath(appRoot + "/ffmpeg/ffprobe.exe");
const config = require('./config.json');
const chokidar = require('chokidar');

const WORKING_DIRECTORY = appRoot + "/public";
const PRESENTATION_FOLDER = "/presentation/";
const TEMPLATES_FOLDER = "/templates/";
const DROP_FOLDER = "/dropfolder/";
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.mp4'];
const TEMPLATE_KEYWORD = 'edit';
const LONG_FIELD_INDICATOR = 'long';
const STANDARD_CANVASWIDTH = 1920;
const STANDARD_CANVASHEIGHT = 1080;
const STANDARD_TRANSITIONSPEED = 0.6;
const IMPORT_FOLDER = process.env.IMPORT_FOLDER;
const IMPORT_TEMPLATES = process.env.IMPORT_TEMPLATES;

// //////////////// //
// HELPER FUNCTIONS //
// //////////////// //

// Remove an element from an array by value
function removeValueFromArray(array, value) {
    if (array && value) {
        return array.filter(function(element) {
            return element != value;
        });
    }
}

// Encode characters that do not pass the XML-test
function xmlEscape(text) {
    return text.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
}

// Unencode characters that do not pass the XML-test
function xmlUnEscape(text) {
    return text.replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .replace(/&amp;/g, '&');
}

// Helper function to check if file is video
function isVideo(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const videoExtensions = ['mp4', 'mov'];
    if (videoExtensions.includes(extension)) {
        return true;
    }
    return false;
}

const end_timeout = 100;

function importFile(filePath, prev) {
    fs.stat(filePath, function (error, stats) {
        if (error) {
            util.log(`Error while importing file ${filePath}: ${error}`);
        } else if (stats.mtime.getTime() === prev.mtime.getTime()) {         // Check if file has stoped growing
            fs.copyFile(filePath, `${WORKING_DIRECTORY}${DROP_FOLDER}${path.basename(filePath)}`, (error) => {
                if (error) {
                    util.log(`Error copying ${path.basename(filePath)}: ${error}`);
                } else {
                    util.log(`${path.basename(filePath)} was copied to ${WORKING_DIRECTORY}${DROP_FOLDER}.`);
                }
            });
        }
        else {
            setTimeout(importFile, end_timeout, filePath, stats);
        }
    });
}

if (fs.existsSync(IMPORT_FOLDER)) {
    chokidar.watch(IMPORT_FOLDER).on('add', async (filePath) => {
        fs.stat(filePath, (err, stat) => {
            if (err) {
                util.log(`Error while detecting file added to watchfolder: ${err}`);
            } else {
                setTimeout(importFile, end_timeout, filePath, stat);
            }
        });
    });
    chokidar.watch(IMPORT_FOLDER).on('unlink', async (filePath) => {
        const original = `${WORKING_DIRECTORY}${DROP_FOLDER}${path.basename(filePath)}`;
        const thumbnail = `${WORKING_DIRECTORY}${DROP_FOLDER}${path.basename(filePath, path.extname(filePath))}.png`;
        fs.unlink(original, (err) => {
            if (err) {
                util.log(`Error while removing ${original}: ${err}`);
            } else {
                io.emit('dropfolder', path.basename(filePath), 'delete');
                util.log(`${path.basename(original)} was removed from dropfolder.`);
            }
        });
        fs.unlink(thumbnail, (err) => {
            if (err) {
                util.log(`Error while removing ${thumbnail}: ${err}`);
            } else { 
                util.log(`${path.basename(thumbnail)} was removed from dropfolder.`);
            }
        });
    });
}

class Project {
    constructor(projectName) {
        this.name = projectName || '';
        this.canvasWidth = STANDARD_CANVASWIDTH;
        this.canvasHeight = STANDARD_CANVASHEIGHT;
        this.transitionSpeed = STANDARD_TRANSITIONSPEED;
        this.numberOfPages = 0;
        this.data = {};
        this.pageIds = [];
        this.media = {};
        this.screenshots = [];
        this.activeSession = '';
        this.owner = '';
    }

    static listTargets() {
        const targets = config.syncTargets;
        let keys = [];
        for(let key in targets) {
            keys.push(key);
        }
        Project.syncTargets = keys;
        return keys;
    }

    // Add user and project combination to the userList.
    static addUser(user, project) {
        if (project && user) {
            // If project is not already listed, create empty array.
            if (!this.userList[project]) {
                this.userList[project] = [];
            }
            if (!this.userList[project].includes(user)) {
                this.userList[project].push(user);
            }
        }
    }

    // Remove user and project combination from the userlist.
    static removeUser(user, project) {
        if (project && user) {
            this.userList[project] = removeValueFromArray(this.userList[project], user);
            // If no users are currently subscribed to this project, remove it from the list.
            if ((this.userList[project] && this.userList[project].length == 0) || this.userList[project] == undefined) {
                delete this.userList[project];
            }
        }
    }

    // Rename a project in the userlist.
    static renameUserListProject(oldName, newName) {
        const users = this.userList[oldName];
        delete this.userList[oldName];
        this.userList[newName] = users;
    }

    // Get full list of all users subscribed to the projects.
    static getUserList() {
        console.log(this.userList);
        return this.userList;
    }

    // Get all users currently subscribed to a particular project.
    static getUsersOfProject(project) {
        if (project) {
            return this.userList[project];
        } else {
            return [];
        }
    }

    static async initiateProjectArray() {
        let promises =  [];
        this.listTargets();
        promises.push(this.listTemplates());
        promises.push(this.listProjects(WORKING_DIRECTORY + PRESENTATION_FOLDER));
        return Promise.all(promises);
    }

    static getProjectArray() {
        return Project.projectArray;
    }

    static generateThumbnail(filePath, prev) {
        fs.stat(filePath, (error, stats) => {
            if (error) { 
                util.log(`Error creating thumbnail of ${filePath}: ${error.message}`);
            } else if (stats.mtime.getTime() === prev.mtime.getTime()) {
                // Make thumbnail
                new ffmpeg({ source: filePath })
                .thumbnail({
                    count: 1,
                    timemarks: ['10%'],
                    filename: '%b.png',
                    folder: `${WORKING_DIRECTORY + DROP_FOLDER}/`
                })
                .on('error', function(error) {
                    util.log(`An error occurred while generating thumbnail: ${error.message}`);
                })
                .on('end', () => {
                    ffmpeg.ffprobe(filePath, (err, metadata) => {
                        if (metadata) {
                            const mediaPackage = {
                                width: metadata.streams[0].width,
                                height: metadata.streams[0].height,
                                dropFolder: true,
                                data: metadata
                            };
                            io.emit('dropfolder', path.basename(filePath), mediaPackage);
                            util.log(`Thumbnail generated for ${path.basename(filePath)}.`);
                        }
                    });
                });  
            }
            else {
                setTimeout(Project.generateThumbnail, end_timeout, filePath, stats);
            }
        });
    }

    static watchFolder() {
        // If IMPORT_FOLDER is present start watching
        if (fs.existsSync(WORKING_DIRECTORY + DROP_FOLDER)) {
            chokidar.watch(WORKING_DIRECTORY + DROP_FOLDER).on('add', async (filePath) => {
                const thumbnailName = `${path.basename(filePath, path.extname(filePath))}.png`;
                if (isVideo(filePath) && !fs.existsSync(thumbnailName)) {
                    // Start generating thumbnail
                    fs.stat(filePath, function (error, stat) {
                        if (error) {
                            util.log(`Error starting generation of thumbnail: ${error.message}.`);
                       } else {
                            setTimeout(Project.generateThumbnail, end_timeout, filePath, stat);
                        }
                    });                    
                }
            });
        }
    }

    set name(name) {
        this._name = name;
    }
    set data(data) {
        this._data = data;
    }
    set activeSession(socketID) {
        this._activeSession = socketID;
    }
    get name() {
        return this._name;
    }
    get data() {
        return this._data;
    }
    get activeSession() {
        return this._activeSession;
    }

    // Return current media path
    mediaLocation() {
        return WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name;
    }

    // Check if project is currently locked
    // Return name of locker
    static getLockedState(projectName) {
        for (let name in Project.projectArray) {
            if (Project.projectArray[name].name == projectName) {
                if (Project.projectArray[name].locked) {
                    return Project.projectArray[name].locked;
                }
            }
        }
        return -1;
    }

    // List all projects and put them in this.projects
    // This function returns a promise
    static listProjects(directory) {

        // Check owner of presentation
        async function getOwner(projectName) {
            const presentationFile = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + projectName}/index.xml`;
            try {
                const xml = await fs.readFile(presentationFile);
                const jsonTemp = convert.xml2js(xml, { compact: true });
                if (jsonTemp.presentation.settings && jsonTemp.presentation.settings.owner) {
                    return jsonTemp.presentation.settings.owner._text;
                }
                return null;
            } catch(error) {
                util.log(`Error reading ${presentationFile}. Ignoring project.`);
                return -1;
            }
        }

        async function getTimeStamp(projectName) {
            const projectScreenShot = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + projectName}/screenshots/project.png`;
            try {
                const timeStamp = await fs.stat(projectScreenShot);
                return timeStamp.mtime;
            } catch(error) {
                return '';
            }
        }

        // Prepare promise with projects list
        let promise = fs.readdir(directory, { withFileTypes: true })
        .then(async (directoryListing) => {
            // Filter on directories
            const files = directoryListing
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
            // Start listing projects and adding curren locked status
            let projects = {};
            for (let i in files) {
                const name = files[i];
                const timeStamp = await getTimeStamp(name);
                const fileName = (timeStamp ? 'project.png' : '/img/blankProject.jpg');
                const project = {
                    'name': name,
                    'screenshot': {
                        'filename': fileName,
                        'timestamp': timeStamp
                    }
                }
                // Retrieve locked status of projects
                const lockedState = this.getLockedState(name);
                if (lockedState != -1) {
                    project.locked = lockedState;
                }
                const owner = await getOwner(name);
                if (owner) {
                    if (owner == -1) {
                        // Problem reading index.xml, ignoring project.
                        continue;
                    }
                    project.owner = owner;
                }
                projects[name] = project;
            }
            // Update the project listing in all projects
            Project.projectArray = projects;
            // Return projects for retrieval through the promise
            return projects;
        })
        .catch((err) => {
            util.log('Presentation folder not found.');
            throw err;
        });
        return promise;
    }


    isMediaUsed(value, json = this.data.presentation.container) {
        function check(value, json) {
            let contains = false;
            Object.keys(json).some(key => {
                contains = typeof json[key] === 'object' ? check(value, json[key]) : json[key] === value;
                return contains;
            });
            return contains;
        }
        for (let container in json) {
            if (check(value, json[container])) {
                return true;
            }
        }
        return false;
    }

    // List all media and put them in this.media
    // This function returns a promise
    async listMedia() {
        try {
            if (this.name) {
                let directory = WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name;
                let directoryListing = await fs.readdir(directory, { withFileTypes: true });
                // Filter on files
                const files = directoryListing
                    .filter(dirent => dirent.isFile())
                    .map(dirent => dirent.name);
                // List all media files
                this.media = {};
                let self = this;
                let promises = [];
                for (let i in files) {
                    if (SUPPORTED_EXTENSIONS.includes(path.extname(files[i]).toLowerCase())) {
                        promises.push(new Promise((resolve, reject) => {
                            const used = this.isMediaUsed(files[i]);
                            ffmpeg.ffprobe(directory + '/' + files[i], (err, metadata) => {
                                if (metadata) {
                                    self.media[files[i]] = {
                                        name: files[i],
                                        width: metadata.streams[0].width,
                                        height: metadata.streams[0].height,
                                        dropFolder: false,
                                        used: used,
                                        data: metadata
                                    };
                                }
                                resolve('complete');
                            });
                        }));
                    }
                }
                if (IMPORT_FOLDER) {
                    const importListing = await fs.readdir(IMPORT_FOLDER, { withFileTypes: true });
                    // Filter on files
                    const importFiles = importListing
                    .filter(dirent => dirent.isFile())
                    .map(dirent => dirent.name);
                    for (let i in importFiles) {
                        if (SUPPORTED_EXTENSIONS.includes(path.extname(importFiles[i]).toLowerCase())) {
                            promises.push(new Promise((resolve, reject) => {
                                ffmpeg.ffprobe(IMPORT_FOLDER + '/' + importFiles[i], (err, metadata) => {
                                    if (metadata) {
                                        self.media[`_${importFiles[i]}`] = {
                                            name: importFiles[i],
                                            width: metadata.streams[0].width,
                                            height: metadata.streams[0].height,
                                            dropFolder: true,
                                            data: metadata
                                        };
                                    }
                                    resolve('complete');
                                });
                            }));
                        }
                    }
                }
                return Promise.all(promises);
            }
        } catch(error) {
            util.log(`Error in listMedia: ${error}`); 
        }
    }

    // Extract fields from template
    // - input filename including path
    // - returns array with fields (id, type, content)
    // This function returns a promise
    static extractFields(fileName) {
        // Function to search through json for fields
        function searchFields(json, editFields) {
            for(var element in json) {
                if (json[element].hasOwnProperty('attributes')) {
                    // Get the description meta data and put it in a _description field.
                    if (json[element].attributes.hasOwnProperty('name') && json[element].attributes.name == 'description') {
                        editFields['_description'] = {
                            type: 'description',
                            content: json[element].attributes.content
                        };
                    }
                    // Get the keywords meta data and put it in a _keywords field.
                    if (json[element].attributes.hasOwnProperty('name') && json[element].attributes.name == 'keywords') {
                        editFields['_keywords'] = {
                            type: 'keywords',
                            content: json[element].attributes.content
                        };
                    }
                    // Take care of the editable fields.
                    if (json[element].attributes.hasOwnProperty('class')) {
                        if (json[element].attributes.class.includes(TEMPLATE_KEYWORD)) {
                            const type = json[element].name;
                            const id = json[element].attributes.id;
                            let field = {
                                type: type
                            };
                            switch(type) {
                                case 'span':
                                case 'div':
                                case 'li':
                                    if (json[element].elements) {
                                        field.content = json[element].elements[0].text;
                                    } else {
                                        field.content = '';
                                    }
                                    break;
                                case 'img':
                                    if (json[element].attributes) {
                                        field.content = json[element].attributes.src;
                                    } else {
                                        field.content = '';
                                    }
                                    break;
                                case 'a':
                                    if (json[element].elements) {
                                        if (json[element].elements[0].type == 'text') {
                                            field.content = json[element].elements[0].text;
                                        }
                                    } else {
                                        field.content = '';
                                    }
                                    field.url = json[element].attributes.page;
                                    field.transition = json[element].attributes.transition;
                                    break;
                            }
                            if (json[element].attributes.class.includes(LONG_FIELD_INDICATOR)) {
                                field.long = true;
                            }
                            editFields[id] = field;
                        }  
                    }
                }
                if (json[element].hasOwnProperty('elements')) {
                    searchFields(json[element].elements, editFields);
                }
            }
        }

        // Prepare the promise with file list
        let promise = fs.readFile(fileName, 'utf8')
        .then((data) => {
            let editFields = {};
            searchFields(convert.xml2js(data).elements, editFields);
            return editFields;
        })
        .catch(error => {
            util.log(`${fileName} not found.`)
            throw error;
        });
        return promise;
    }

    // Extract assets from template
    // - input filename including path
    // - returns array with assets (json)
    // This function returns a promise
    static async extractAssets(fileName) {
        
        // Function to search through json for assets
        function findAssets(json, assetsJson) {
            for(var element in json) {
                if (json[element].hasOwnProperty('attributes')) {
                    if (json[element].name == 'script' && json[element].attributes.id == 'touch') {
                        const jsonData = JSON.parse(json[element].elements[0].text);
                        for (let k in jsonData) {
                            assetsJson[k] = jsonData[k];
                        }
                    }
                }
                if (json[element].hasOwnProperty('elements')) {
                    findAssets(json[element].elements, assetsJson);
                }
            }
        }
        
        // Prepare promise with file list
        let promise = fs.readFile(fileName, 'utf8')
        .then((data) => {
            let assetsJson = {};
            if (path.extname(fileName).toLowerCase() == '.html') {
                findAssets(convert.xml2js(data).elements, assetsJson);
            } else if (path.extname(fileName).toLowerCase() == '.json') {
                try {
                    assetsJson = JSON.parse(data);
                } catch (error) {
                    if (error.name == 'SyntaxError') {
                        util.log(`Error parsing ${fileName}.`);
                    }
                }
            }
            return assetsJson;
        })
        .catch(error => {
            util.log(`${fileName} not found.`)
            throw error;
        });
        return promise;
    }

    // Inject values in fields from template
    // - input xml with fields to be filled out
    // - input fields -> format (id, type, content)
    // - returns updated template
    injectFields(xml, fields) {
        function searchFields(json, fields) {
            for (var element in json) {
                if (json[element].hasOwnProperty('attributes')) {
                    if (json[element].attributes.hasOwnProperty('class')) {
                        if (json[element].attributes.class.includes(TEMPLATE_KEYWORD)) {
                            const type = json[element].name;
                            const id = json[element].attributes.id;
                            switch(type) {
                                case 'span':
                                case 'div':
                                    let textField = fields[id].content ? fields[id].content : ''; 
                                    if (json[element].elements) {
                                        json[element].elements[0].text = textField;
                                    } else {
                                        json[element].elements = [{ 'type': 'text', 'text': textField }];
                                    }
                                    break;
                                case 'li':
                                    if (fields[id].content && typeof fields[id].content == 'string') {
                                        if (json[element].elements) {
                                            json[element].elements[0].text = fields[id].content;
                                        } else {
                                            json[element].elements = [{ 'type': 'text', 'text': fields[id].content }];
                                        }
                                    } else {
                                        json[element].attributes.style = "display:none";                                     
                                    }
                                    break;
                                case 'img':
                                    if (fields[id].content && typeof fields[id].content == 'string') {
                                        json[element].attributes.src = fields[id].content;
                                    } else {
                                        json[element].attributes.style = "display:none";
                                        json[element].attributes.src = "";
                                    }
                                    break;
                                case 'a':
                                    if (fields[id].hasOwnProperty('content')) {
                                        let textField = fields[id].content ? fields[id].content : ''; 
                                        if (json[element].elements) {
                                            json[element].elements[0].text = textField;
                                        } else {
                                            json[element].elements = [{ 'type': 'text', 'text': textField }];
                                        }
                                    }
                                    if (fields[id].url) {
                                        json[element].attributes.page = fields[id].url;
                                        if (fields[id].transition) {
                                            json[element].attributes.transition = fields[id].transition;
                                        }
                                    } else if (fields[id].hasOwnProperty('content')) {
                                        json[element].attributes.style = "display:none";
                                    }
                                    break;
                            }
                        }
                    }
                }
                if (json[element].hasOwnProperty('elements')) {
                    searchFields(json[element].elements, fields);
                }
            }
        }
        const template = convert.xml2js(xml);
        searchFields(template.elements, fields);
        const options = {
            spaces: 2,
            fullTagEmptyElement: true // To make sure the script tag is not self-closing
        }
        return convert.js2xml(template, options).replace(/&amp;/g, '&');
    }

    // Import new templates into the system
    static async importTemplates() {
        // List source and destinations
        const sourceDir = IMPORT_TEMPLATES;
        const destinationDirs = [];
        destinationDirs.push(WORKING_DIRECTORY + TEMPLATES_FOLDER); // Local instance of template directory
        for (let index in Project.syncTargets) {
            // List all directories registered as target (in configuration file)
            destinationDirs.push(config.syncTargets[Project.syncTargets[index]].dataPath + TEMPLATES_FOLDER);
        }
        // Prepare promises 
        const promises = [];
        if (sourceDir) {
            for (let index in destinationDirs) {
                const destinationDir = destinationDirs[index];
                const promise = fs.copy(sourceDir, destinationDir, { overwrite: true })
                    .then(async () => {
                        // When local instance of template directory is populated, inform the clients
                        // of the update.
                        if (index == 0) {
                            await Project.listTemplates();
                            io.emit('templates', Project.templates);
                        }
                        util.log(`Imported templates from ${sourceDir} naar ${destinationDirs[index]}.`);
                    })
                    .catch((error) => util.log(`Error syncing templates folder: ${error.message}.`));
                promises.push(promise);
            }
        }
        return Promise.all(promises);
    }

    // List all templates and put them in Project.templates
    // This function returns a promise
    static listTemplates() {
        let directory = WORKING_DIRECTORY + TEMPLATES_FOLDER;
        Project.templates = [];
        const promiseHtml = fs.readdir(directory + 'html/', { withFileTypes: true })
        .then(async (directoryListing) => {
            // Filter on files
            const files = directoryListing
                .filter(dirent => dirent.isFile())
                .map(dirent => 'html/' + dirent.name);
            let templatesHtml = [];
            // Iterate through html templates and extract editable fields and assets
            for (let i in files) {
                const file = path.join(directory, files[i]);
                if (path.extname(file).toLowerCase() == '.html') {
                    const fields = await Project.extractFields(file);
                    const assets = await Project.extractAssets(file);
                    const templateData = {
                        template: path.basename(file),
                        filePath: TEMPLATES_FOLDER + 'html/',
                        fields: fields
                    }
                    for (let key in assets) {
                        templateData[key] = assets[key];
                    }
                    templatesHtml.push(templateData);
                }
            }
            Project.templates = Project.templates.concat(templatesHtml);
        })
        .catch((error) => {
            util.log(`Templates html folder ${directory}html/ not found. ${error.message}`);
        })
        const promiseJson = fs.readdir(directory + 'json/', { withFileTypes: true })
        .then(async (directoryListing) => {
            // Filter on files
            const files = directoryListing
                .filter(dirent => dirent.isFile())
                .map(dirent => 'json/' + dirent.name);
            let templatesJson = [];
            // Iterate through json templates and extract assets
            for (let i in files) {
                const file = path.join(directory, files[i]);
                if (path.extname(file).toLowerCase() == '.json') {
                    const assets = await Project.extractAssets(file);                   
                    const templateData = {
                        template: path.basename(file),
                        filePath: TEMPLATES_FOLDER + 'json/',
                    }
                    for (let key in assets) {
                        templateData[key] = assets[key];
                    }
                    templatesJson.push(templateData);
                }
            }
            Project.templates = Project.templates.concat(templatesJson);
        })
        .catch((error) => {
            util.log(`Templates json folder ${directory}json/ not found. ${error.message}`);
        })
        return Promise.all([promiseHtml, promiseJson]);
    }

    // List all screenshots and put them in this.screenshots
    // This function returns a promise
    async listScreenshots() {
        let directory = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/screenshots/`;
        await fs.ensureDir(directory);
        // Prepare promise with list of screenshots
        let promise = fs.readdir(directory, { withFileTypes: true })
        .then(async (directoryListing) => {
            // Filter on files
            const files = directoryListing
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name);            
            this.screenshots = {};
            for (let i in files) {
                const timeStamp = await fs.stat(`${directory}/${files[i]}`);
                if (files[i].endsWith('_small.png')) {
                    this.screenshots[files[i]] = timeStamp.mtime;
                }
            }
            io.to(this.activeSession).emit('screenshots', this.screenshots);
            util.log(`Updated list of screenshots sent to ${this.activeSession}.`);
        })
        .catch(error => {
            util.log(`Cannot find screenshots directory ${directory}. ${error}`);
            throw error;
        });
        return promise;
    }

    // Update the state parameters
    async updateState(pageUpdated = null, screenShots = true) {
        // Get settings and list of all containers
        let settings = this.data.presentation.settings;
        let containers = this.data.presentation.container;

        // Get canvas dimensions
        this.canvasWidth = (settings.canvasWidth ? settings.canvasWidth : STANDARD_CANVASWIDTH);
        this.canvasHeight = (settings.canvasHeight ? settings.canvasHeight : STANDARD_CANVASHEIGHT);
        
        // Get transition speed
        this.transitionSpeed = (settings.transitionSpeed ? settings.transitionSpeed : STANDARD_TRANSITIONSPEED);

        // Get total number of containers
        this.numberOfPages = containers.length;

        // Get project owner (for private projects)
        this.owner = (settings.owner ? settings.owner : '');

        // List media
        await this.listMedia();

        // List screenshots
        if (screenShots) await this.listScreenshots();

        // Run through all containers and prepare ID list
        this.pageIds = [];
        for(var key in containers) {
            this.pageIds.push(containers[key].id);
        }

        // Send updated status to all subscribers or just the current one.
        this.sendStatus(pageUpdated);
    }


    // Lock project
    lock() {
        for (let name in Project.projectArray) {
            if (Project.projectArray[name].name == this.name) {
                Project.projectArray[name].locked = this.activeSession;
            } else if (Project.projectArray[name].locked == this.activeSession) {
                delete Project.projectArray[name].locked;
            } 
        }
        Project.sendProjectsUpdate();
    }

    // unlock project
    static unLock(userName) {
        for (let name in Project.projectArray) {
            if (Project.projectArray[name].locked == userName) {
                delete Project.projectArray[name].locked;
            } 
        }
        Project.sendProjectsUpdate();
    }

    static sendProjectsUpdate() {
        io.emit('updateProjects', Project.projectArray, PRESENTATION_FOLDER);  // TODO workaround for missing a status update while getting a listproject result
    }

    // Read project data from file
    async read() {    // TODO: this can be cleaner, using explicit Promise
        const presentationFile = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/index.xml`;
        await fs.readFile(presentationFile)
        .then(async (xml) => {
            const jsonTemp = this.createJson(xml);
            if (jsonTemp != -1) {
                this.lock();
                this.data = jsonTemp;
                await this.cleanAssets();
                await this.listMedia();
                // Send an updated status to only the current user.
                await this.updateState();
                Project.sendProjectsUpdate();
                this.sendXml();
                this.triggerPage(-1);   // -1 indicates that root page must be loaded for the first time
                io.to(this.activeSession).emit('projectReady');
                util.log(`Read ${this.name} project data.`);
            } else {
                this.message(`<p>Probleem bij het lezen van het projectbestand voor presentatie ${this.name}.</p>`);
                util.log(`Error reading presentation file: ${this.name}.`);                        
            }
        })
        .catch(() => {
            this.message(`<p>Projectbestand voor presentatie ${this.name} niet gevonden.</p>`);
            util.log(`Did not find presentation file: ${this.name}.`);
        });
    }

    // Create new project
    async create(user) {
        // Create a project name in de format "Project #" and make sure that the
        // name is not already in use. When in use, increment the number.        
        const numberOfProjects = Object.keys(Project.projectArray).length;
        let projectIndex = Number(numberOfProjects) + 1;
        let projectName = `Project ${projectIndex}`;
        while (Project.projectArray.hasOwnProperty(projectName)) {
            projectName = `Project ${++projectIndex}`;
        }
        const newProjectPath = WORKING_DIRECTORY + PRESENTATION_FOLDER + projectName;
        try {
            await fs.mkdir(newProjectPath);
            await fs.mkdir(newProjectPath + "/screenshots");
            this.name = projectName;
            this.media = {};
            this.pageIds = ["0"];
            this.numberOfPages = 1;
            this.canvasWidth = STANDARD_CANVASWIDTH;
            this.canvasHeight = STANDARD_CANVASHEIGHT;
            this.transitionSpeed = STANDARD_TRANSITIONSPEED;
            this.data = {
                presentation: {
                    settings: {
                        canvasWidth: this.canvasWidth,
                        canvasHeight: this.canvasHeight,
                        transitionSpeed: this.transitionSpeed
                    },
                    container: {
                        id: 0,
                        background: ""
                    }
                }
            }
            this.lock();
            await this.write();
            await Project.initiateProjectArray();
            await this.cleanAssets();
            this.sendStatus();
            this.triggerPage(-1);  // -1 indicates that root page must be loaded for the first time
            Project.sendProjectsUpdate();
            Project.addUser(user, projectName);
            Project.getUserList();
            util.log(`Created ${projectName} project.`);
        } catch(err) {
            util.log(err);
        }
    }
   
    // Rename project directory
    async rename(newName) {
        if (this.name) {
            let currPath = WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name;
            let newPath = WORKING_DIRECTORY + PRESENTATION_FOLDER + newName;
            try {
                await fs.copy(currPath, newPath);
                await fs.remove(currPath);
                await Project.initiateProjectArray();
                this.name = newName;
                this.lock();
                this.sendStatus();
                this.sendXml();
                util.log(`Successfully renamed project ${newName}.`);
            } catch(err) {
                this.message(`<p>Fout bij het hernoemen van ${this.name}</p>`);
                util.log(err);
            }
        }
    }

    // Change settings
    async changeSettings(settings) {
        if (settings.projectName != this.name) {
            Project.renameUserListProject(this.name, settings.projectName);
            await this.rename(settings.projectName);
            Project.getUserList();
            this.name = settings.projectName;
        }
        this.data.presentation.settings.canvasWidth = settings.canvasWidth;
        this.data.presentation.settings.canvasHeight = settings.canvasHeight;
        this.data.presentation.settings.transitionSpeed = settings.transitionSpeed;
        this.data.presentation.settings.owner = settings.owner;
        await this.write();
        await Project.initiateProjectArray();
        this.updateState();
        this.sendXml();
        Project.sendProjectsUpdate();
        this.message(`<h1>Intellingen presentatie <i>"${this.name}"</i> succesvol gewijzigd.</h1>`);
        util.log(`Changed settings of ${this.name}.`);
    }

    // Cleaning the assets
    async cleanAssets() {
        let containers = this.data.presentation.container;
        if (containers) {
            if (containers.length) {
                // More than one page detected
                for (var i in containers) {
                    // In case only one asset is present, move that asset to
                    // an array to make further processing easier.
                    if (containers[i].asset && !containers[i].asset.length) {
                        let assets = [];
                        assets.push(containers[i].asset);
                        containers[i].asset = assets
                    }
                    // Check if a template has been selected. If so, retrieve
                    // all editable fields of the template, if not present already.
                    if (containers[i].html && containers[i].html != '') {
                        if (!containers[i].fields) {
                            let url = containers[i].html;
                            if (!url.startsWith('http')) {
                                containers[i].fields = await Project.extractFields(WORKING_DIRECTORY + TEMPLATES_FOLDER + 'html/' + url);
                            }
                        }
                    }
                    // Make sure that the content fields do not contain characters that break XML
                    if (containers[i].fields) {
                        for (let j in containers[i].fields) {
                            if (containers[i].fields[j].content && 
                                (containers[i].fields[j].type == 'span' || 
                                 containers[i].fields[j].type == 'description')) {                        
                                containers[i].fields[j].content = xmlEscape(xmlUnEscape(containers[i].fields[j].content.toString())).toString();
                            }
                            // TODO: Dirty workaround for the [object Object] value appearing in a field
                            if (containers[i].fields[j].content == "[object Object]") {
                                containers[i].fields[j].content = '';
                            }
                        }
                    }
                }
                this.data.presentation.container = containers;
            } else {
                // TODO this part can be removed
                // Only One page detected
                if (!containers.next) {
                    containers.next = -1;
                }
                // In case only one asset is present, move that asset to
                // an array to make further processing easier.
                if (containers.asset && !containers.asset.length) {
                    let assets = [];
                    assets.push(containers.asset);
                    containers.asset = assets
                }
                // Check if a template has been selected. If so, retrieve
                // all editable fields of the template.
                if (containers.html && containers.html != '') {
                    let url = containers.html;
                    if (!url.startsWith('http')) {
                        containers.fields = await Project.extractFields(WORKING_DIRECTORY + TEMPLATES_FOLDER + 'html/' + url);
                    }
                }
                this.data.presentation.container = [];
                this.data.presentation.container[0] = containers;       
            }
        } else {
            // No page detected
            this.data.presentation.container = [];
        }
    }

    // Write project data to file
    async write() {
        const presentationXml = convert.json2xml(this.data, {compact: true, spaces: 4, fullTagEmptyElement: true}).replace(/&amp;/g, '&');
        const name = this.name;
        fs.writeFile(`${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/index.xml`, presentationXml, function(err) {
            if (err) throw err;
            util.log(`Saved ${name} project.`);
        });
    }

    // Send status to client(s)
    sendStatus(updatedPage = null) {
        // Verify if presentation data has been read completely
        // This caused the system to crash often (TODO: optimize)
        let data = {};
        if (this.data.presentation != undefined) {
            data = this.data.presentation.container;
        }
        // Prepare data packet to be shared with client
        const state = {
            syncTargets: Project.syncTargets,
            presentationFolder: PRESENTATION_FOLDER,
            templatesFolder: TEMPLATES_FOLDER,
            projectName: this.name,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            transitionSpeed: this.transitionSpeed,
            numberOfPages: this.numberOfPages,
            pageIds: this.pageIds,
            media: this.media,
            screenshots: this.screenshots,
            templates: Project.templates,
            data: data
        }
        if (this.owner) {
            state.owner = this.owner;
        }

        // When the project has been updated, send the new status to all users
        // subscribed to this project.
        if (updatedPage != null) {
            const currentUsers = Project.getUsersOfProject(this.name);
            for (let user in currentUsers) {
                io.to(currentUsers[user]).emit('status', state, updatedPage);
            }
        } else {
            io.to(this.activeSession).emit('status', state);
        }
    }

    // Send updated media status to client(s)
    sendMediaStatus() {
        // Verify if presentation data has been read completely
        // This caused the system to crash often (TODO: optimize)
        let data = {};
        if (this.data.presentation != undefined) {
            data = this.data.presentation.container;
        }
        // Prepare data packet to be shared with client
        io.to(this.activeSession).emit('media', this.media);
    }

    // Tiggers a page switch to all clients connected to this user?
    triggerPage(pageId) {
        if (pageId >= -1 && pageId < this.data.presentation.container.length) {
            io.to(this.activeSession).emit('page', pageId);            
        }
    }

    // Create validated JSON data
    createJson(xml) {
        // Callback textFn for convert.json2xml to remove the _text attribute
        function RemoveJsonTextAttribute(value, parentElement) {
            try {
                let keyNo = Object.keys(parentElement._parent).length;
                let keyName = Object.keys(parentElement._parent)[keyNo-1];
                parentElement._parent[keyName] = value;
            } catch(e) {
                util.log(`Error parsing JSON ${e}`);
            }
        }
        // Clean-up function to remove empty Objects
        function RemoveEmptyObjects(obj) {
            for (const [key, value] of Object.entries(obj)) {
                if (Object.keys(value).length === 0 && value.constructor === Object) {
                    delete obj[key];
                }
            }
            return obj;
        }
        // Options for the XML to JSON conversion
        let options = {
            compact: true,
            trim: true,
            nativeType: false,      // Whether to attempt converting text of numerals or of boolean values to native type.
            alwaysArray: false,      // Whether to always put sub element, even if it is one only, as an item inside an array.
            ignoreDeclaration: true,
            ignoreInstruction: true,
            ignoreAttributes: true,
            ignoreComment: true,
            ignoreCdata: true,
            ignoreDoctype: true,
            textFn: RemoveJsonTextAttribute,
            spaces: 4
        };
        // Remove all empty objects
        let jsonOutput = null;
        try {
            jsonOutput = convert.xml2js(xml, options);
        } catch {
            return -1;
        }
        if (jsonOutput.presentation.container) {
            RemoveEmptyObjects(jsonOutput.presentation.settings);
            let pages = (Array.isArray(jsonOutput.presentation.container) ? jsonOutput.presentation.container : [jsonOutput.presentation.container]);
            pages.forEach(page => {
                // Check page asttributes for empty objects
                RemoveEmptyObjects(page);
                // Check for empty objects in assets list
                if (page.hasOwnProperty('asset')) {
                    // Page has more than one asset associated
                    if (Array.isArray(page.asset)) {
                        page.asset.forEach(asset => {
                            RemoveEmptyObjects(asset);
                        });
                    // Page has only one asset associated
                    } else {
                        RemoveEmptyObjects(page.asset);
                    }
                }
            });
            jsonOutput.presentation.container = pages;
        }
        return jsonOutput;
    }
    
    // Send XML data
    sendXml() {
        const presentationXml = convert.json2xml(this.data, {compact: true, spaces: 4, fullTagEmptyElement: true}).replace(/&amp;/g, '&');
        if (presentationXml) {
            io.to(this.activeSession).emit('xml', presentationXml, this.createJson(presentationXml));
            util.log(`Sending XML to client ${this.activeSession}.`);
        }
    }   

    // Rename pagename
    renamePage(oldName, newName) {
        let containers = this.data.presentation.container;
        for (var i in containers) {
            if (containers[i].next && containers[i].next == oldName) {
                containers[i].next = newName;
            }
            if (containers[i].asset) {
                if (Array.isArray(containers[i].asset)) {
                    for (var j in containers[i].asset) {
                        if (containers[i].asset[j].url && containers[i].asset[j].url == oldName) {
                            containers[i].asset[j].url = newName;
                        }
                    }
                } else {
                    if (containers[i].asset[j].url && containers[i].asset.url == oldName) {
                        containers[i].asset.url = newName;
                    }                    
                }
            }
        }
    }

    // Save edited page
    async savePage(page, id) {

        const screenShotsLocation = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/screenshots/`;            
        // Create screenshots folder if it does not exists    
        await fs.ensureDir(screenShotsLocation);

        // Check if page already exists and a rename is due
        if (id < this.pageIds.length && this.pageIds[id] != page.id) {
            this.renamePage(this.pageIds[id], page.id);
            // Remove old html page
            if (page.template && page.template != '' && !page.template.endsWith('.json')) {
                fs.remove(`${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/page_${this.pageIds[id]}.html`, error => {
                    if (error) util.log('Error removing old page: ' + error);
                });
            }
            // Remove old screenshots
            fs.remove(`${screenShotsLocation}page_${this.pageIds[id]}.png`, error => {
                if (error) util.log('Error removing old thumbnail: ' + error);
            });
            fs.remove(`${screenShotsLocation}page_${this.pageIds[id]}_small.png`, error => {
                if (error) util.log('Error removing old small thumbnail: ' + error);
            });
            this.pageIds[id] = page.id;
        }
        // If the proposed index is larger than the last + 1, correct it
        // to become the last +1
        if (id >= this.pageIds.length) {
            id = this.pageIds.length;
            this.pageIds[id] = page.id;
        }
        // If no local copy of the template is present
        // copy a version from the template repository
        if (page.template && page.template != '') {
            const template = page.template;
            if (!template.endsWith('.json')) {
                const inputFileName = WORKING_DIRECTORY + TEMPLATES_FOLDER + 'html/' + template;
                try {
                    const xmlInputData = await fs.readFile(inputFileName, 'utf8');
                    const xmlOutputData = this.injectFields(xmlInputData, page.fields);
                    const outputFileName = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/page_${this.pageIds[id]}.html`;
                    await fs.writeFile(outputFileName, xmlOutputData);
                    io.to(this.activeSession).emit('renderedPage', id);
                    util.log(`Copied template ${outputFileName} to project.`);   
                } catch(error) {
                    this.message(`<p>Probleem bij het toepassen van template ${template}</p>`);
                    util.log(`Error processing template: ${error}`);
                }              
            }            
        }
        this.data.presentation.container[id] = page;
        await this.cleanAssets();
        this.updateState(page.id, false); // The update of the screenshots is taken care of in a separate process TODO: maybe combine in one process
        this.sendXml();
        this.write();
        util.log(`Saved page ${page.id}.`);
    }

    // Save edited page
    async saveXml(page) {
        this.data = this.createJson(page);
        await this.cleanAssets();
        this.updateState();
        this.write();
        util.log(`Saved XML page.`);
    }

    // Save uploaded media to server (single file only)
    async saveMedia(uploadedFile) {
        let fileName = uploadedFile.name.replace(/[&\/\\#, +()$~%'":*?<>{}]/g, '_');
        let newFileName = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/${fileName}`
        // Use the mv() method to place the file somewhere on the server
        let self = this;
        await uploadedFile.mv(newFileName, async function(err) {
            if (err) {
                util.log(`Error uploading file: ${err}.`);
            } else {
                util.log(`Uploaded ${fileName}.`);
            }
            if (isVideo(newFileName)) {
                // Make thumbnail
                await new ffmpeg(newFileName)
                .thumbnail({
                    count: 1,
                    timemarks: ['10%'],
                    filename: '%b.png',
                    folder: `${WORKING_DIRECTORY + PRESENTATION_FOLDER + self.name}/screenshots/`
                })
                .on('end', async function() {
                    await self.listMedia();
                    self.sendMediaStatus();
                })
                .on('error', function(err) {
                    util.log('An error occurred: ' + err.message);
                });
            } else {
                // Refresh media in browser
                self.listMedia()
                .then(() => {
                    self.sendMediaStatus();
                });
            }
        });
    }

    // Swap pages
    swapPage(pageIndex1, pageIndex2) {
        util.log(`Swap pages ${pageIndex1} and ${pageIndex2} .`);
        const temp = this.pageIds[pageIndex1];
        this.pageIds[pageIndex1] = this.pageIds[pageIndex2];
        this.pageIds[pageIndex2] = temp;
        const temp1 = this.data.presentation.container[pageIndex1];
        this.data.presentation.container[pageIndex1] = this.data.presentation.container[pageIndex2];
        this.data.presentation.container[pageIndex2] = temp1;
        this.sendXml();
        this.write();
    }

    // Move pages
    movePage(pageIndex1, pageIndex2) {
        util.log(`Move pages ${pageIndex1} directly behind ${pageIndex2} .`);
        const temp = this.pageIds[pageIndex1];
        const temp1 = this.data.presentation.container[pageIndex1];
        this.pageIds.splice(pageIndex1, 1);
        this.data.presentation.container.splice(pageIndex1, 1);
        if (pageIndex1 < pageIndex2) {
            this.pageIds.splice(pageIndex2, 0, temp);
            this.data.presentation.container.splice(pageIndex2, 0, temp1);
        } else {
            this.pageIds.splice(parseInt(pageIndex2) + 1, 0, temp);
            this.data.presentation.container.splice(parseInt(pageIndex2) + 1, 0, temp1);
        }
        this.sendXml();
        this.write();
        this.sendStatus();
        this.listScreenshots();
    }

    // Delete page
    deletePage(pageId) {
        util.log(`Delete page ${pageId}.`);
        const screenShotsLocation = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/screenshots/`;
        const fileName = `page_${this.pageIds[pageId]}`;
        this.pageIds.splice(pageId, 1);
        this.data.presentation.container.splice(pageId, 1);
        io.to(this.activeSession).emit('deleted', this.pageIds[pageId]);
        this.sendXml();
        this.write();
        // Remove template
        Promise.all([
            fs.remove(`${WORKING_DIRECTORY}${PRESENTATION_FOLDER}${this.name}/${fileName}.html`),
            fs.remove(`${screenShotsLocation}${fileName}.png`),
            fs.remove(`${screenShotsLocation}${fileName}_small.png`)
        ])
        .then(() => {
            util.log(`Deleted snapshots ${pageId}`);
        })
        .catch(error => {
            util.log(`Error removing template ${pageId}: ${error}`);
        });
    }

    // Consolidate media from dropfolder to project
    async consolidateMedia(media) {
        const source = `${WORKING_DIRECTORY}${DROP_FOLDER}${path.basename(media)}`;
        const target = `${WORKING_DIRECTORY}${PRESENTATION_FOLDER}${this.name}/${path.basename(media)}`;
        const thumbnail = `${WORKING_DIRECTORY}${DROP_FOLDER}${path.basename(media, path.extname(media))}.png`;
        const thumbnailTarget = `${WORKING_DIRECTORY}${PRESENTATION_FOLDER}${this.name}/screenshots/${path.basename(media, path.extname(media))}.png`;
        fs.copy(source, target, { overwrite: false })
        .then(() => {
            fs.copy(thumbnail, thumbnailTarget, { overwrite: false })
            .then(() => {
                this.listMedia()
                .then(() =>  {
                    this.sendMediaStatus();
                    io.to(this.activeSession).emit('consolidatedMedia', media);
                    util.log(`Consolidated media from ${source} to ${target}.`);
                });
            })
            .catch((error) => {
                util.log(`Error consolidating thumbnail ${thumbnailTarget}: ${error.name}.`)
            });
        })
        .catch((error) => {
            util.log(`Error consolidating media from ${source} to ${target}: ${error.name}.`);
        });
    }

    // Delete media
    deleteMedia(media) {
        const filePath = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/${media}`;
        let promises = [];
        promises.push(fs.remove(filePath));
        if (isVideo(media)) {
            promises.push(fs.remove(`${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/screenshots/${media.replace(/\.[^/.]+$/, '')}.png`));
        }
        Promise.all(promises)
        .then(() => {
            this.listMedia()
            .then(() =>  {
                this.sendMediaStatus()
            });
            util.log(`Deleted ${media}.`);            
        })
        .catch(error => {
            this.message(`<p>Fout bij het verwijderen van ${media}.</p>`);
            util.log(`Cannot delete ${filePath}: ${error}`);
        });
    }

    // Remove all unused media
    cleanOutMedia() {
        let files = [];
        for (let media in this.media) {
            if (!this.isMediaUsed(media) && media.charAt() != '_') {
                this.deleteMedia(media);
                files.push(media); // TODO: feed this as an array to deleteMedia()
            }
        }
    }

    // Save screenshot received from customer
    saveScreenShot(pageName, base64Data) {
        try {
            // Decoding base-64 image
            // Source: http://stackoverflow.com/questions/20267939/nodejs-write-base64-image-file
            function decodeBase64Image(dataString) {
                let matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                let response = {};
                if (matches.length !== 3) {
                    return new Error('decodeBase64Image() - Invalid input string.');
                }
                response.type = matches[1];
                response.data = Buffer.from(matches[2], 'base64');
                return response;
            }
    
            // Regular expression for image type:
            // This regular image extracts the "jpeg" from "image/jpeg"
            let imageTypeRegularExpression = /\/(.*?)$/;      
            let imageBuffer = decodeBase64Image(base64Data);
            const screenShotsLocation = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}/screenshots/`;
            const fileName = `page_${pageName}`;

            // This variable is actually an array which has 5 values,
            // The [1] value is the real image extension
            const imageTypeDetected = imageBuffer.type.match(imageTypeRegularExpression);
            const imagePath = `${screenShotsLocation + fileName}.${imageTypeDetected[1]}`;
    
            // Save decoded binary image to disk
            try {
                let self = this;
                let promises = [];
                promises.push(fs.writeFile(imagePath, imageBuffer.data));
                promises.push(sharp(imageBuffer.data)
                    .resize(200, 200, {
                        fit: sharp.fit.inside,
                        withoutEnlargement: true
                    })
                    .toFile(screenShotsLocation + fileName + '_small.' + imageTypeDetected[1], (error, info) => { 
                        if (error) {
                            util.log(`Error saving screenshot thumbnail: ${error}`);
                        }
                    }));
                Promise.all(promises)
                .then(() => {
                    self.listScreenshots();
                });
                if (pageName == this.pageIds[0]) {
                    const projectImagePath = `${screenShotsLocation}project.${imageTypeDetected[1]}`;
                    let self = this;
                    fs.writeFile(projectImagePath, imageBuffer.data, function() {
                        fs.stat(projectImagePath, (err, data) => {
                            Project.projectArray[self.name].screenshot.filename = path.basename(projectImagePath);
                            Project.projectArray[self.name].screenshot.timestamp = data.mtime;
                            Project.sendProjectsUpdate();
                            util.log(`Project screenshot saved.`);
                        });
                    });
                }
            } catch(error) {
                util.log(`Error saving screenshot: ${error}`);
            }
        } catch(error) {
            util.log(`Error saving screenshot: ${error}`);
        }
    }

    reloadOtto() {
        // create an empty file
        const tempPath = `${IMPORT_FOLDER}/${Date.now()}.txt`;
        fs.open(tempPath, 'w', (err, file) => {
            if (err) {
                util.log(err);
            }
            util.log(`Temp file ${file} is created.`);
        });
    }

    // Sync project with remote server
    sync(target) {
        // Callback function to send out current status
        function reportProgress(line, status = null) {
            if (status == null) {
                message.text = `${line}` + message.text;
            } else {
                message.text = `${line} (${parseInt(totalNumberOfFiles) - parseInt(numberOfFilesRemaining)}/${totalNumberOfFiles}) <b>${status}</b><br />` + message.text;
            }
            // Check if all files have been covered
            if (numberOfFilesRemaining == 0) {
                if (errors) {
                    message.ok = true;
                    message.text = '<h3>Synchonisatie mislukt.</h3><p>Contacteer administator.</p>' + message.text;
                    util.log(`${self.name} failed to sync.`);
                } else {
                    message.ok = true;
                    message.text = `<h3>Synchonisatie met ${target} succesvol.</h3>` + message.text;
                    util.log(`${self.name} synced.`);
                }
            } else if (numberOfFilesRemaining == 1) {
                fs.copy(`${currentFolder}/index.xml`, `${syncPath}/index.xml`, { overwrite: true })
                .then(() => {
                    numberOfFilesRemaining--;
                    reportProgress('index.xml', 'OK');
                })
                .catch(() => {
                    numberOfFilesRemaining--;
                    reportProgress('index.xml', 'ERROR');                     
                    errors = true;
                });
            }
            io.to(self.activeSession).emit('message', message);
        }

        const currentFolder = `${WORKING_DIRECTORY + PRESENTATION_FOLDER + this.name}`;
        const syncPath = `${config.syncTargets[target].dataPath + PRESENTATION_FOLDER + this.name}`;
        const self = this;

        let message = {
            title: `Synchronisatie naar ${target}`,
            text: '',
            ok: true
        }
        let totalNumberOfFiles = 0;
        let numberOfFilesRemaining = -1;
        let errors = false;
        let sourceFiles = [];

        // Check if project has been selected
        if (this.name == '') {
            reportProgress('<p>Geen project geselecteerd.</p>');
            util.log(`${this.name} failed to sync, because no project was selected.`);
        } else {
            // Check if remote location is available
            fs.pathExists(config.syncTargets[target].dataPath, (err, confirmed) => {
                if (!confirmed || err) {
                    reportProgress(`<h3>De ${target} server is niet bereikbaar.</h3><p>Waarschijnlijk staat de computer uit.</p><p>Contacteer <b>FONS (5050)</b> om de TouchDesigner computer aan te zetten.</p>`);
                    util.log(`${this.name} failed to sync, bacause ${target} location not available.`);
                    return;                    
                }
                // Send message confirming start of synchronisation
                message.ok = false;
                reportProgress(`<h3>Synchronisatie met ${target} gestart...</h3>`);
                // Get complete list of source files
                fs.readdir(currentFolder, { withFileTypes: true }, (err, dirents) => {
                    // Exclude directories from the list
                    sourceFiles = dirents
                        .filter(dirent => dirent.isFile())
                        .map(dirent => dirent.name);
                    // Get List of all target files
                    fs.readdir(syncPath, { withFileTypes: true }, (err, dirents2) => {
                        let filesToBeDeleted = [];
                        if (!err) {
                            // Exclude directories from the list
                            const targetFiles = dirents2
                                .filter(dirent => dirent.isFile())
                                .map(dirent => dirent.name);
                            // Get list of all target files that can be cleaned up
                            for (let i in targetFiles) {
                                if (!sourceFiles.includes(targetFiles[i])) {
                                    filesToBeDeleted.push(targetFiles[i]);
                                }
                            }
                        }
                        // Get number of items to be processed
                        totalNumberOfFiles = sourceFiles.length + filesToBeDeleted.length;
                        numberOfFilesRemaining = totalNumberOfFiles;
                        // Copy all files available in source location
                        for (let i in sourceFiles) {
                            if (sourceFiles[i] == 'index.xml') {
                                // fs.copy(`${currentFolder}/index.xml`, `${syncPath}/index.xml`, { overwrite: true })
                                // .then(() => {
                                //     numberOfFilesRemaining--;
                                //     reportProgress(sourceFiles[i], 'OK');
                                // })
                                // .catch(() => {
                                //     numberOfFilesRemaining--;
                                //     reportProgress(sourceFiles[i], 'ERROR');                     
                                //     errors = true;
                                // });
                            } else {
                                fs.copy(`${currentFolder}/${sourceFiles[i]}`, `${syncPath}/${sourceFiles[i]}`, { overwrite: true })
                                .then(() => {
                                    numberOfFilesRemaining--;
                                    reportProgress(sourceFiles[i], 'OK');
                                }) 
                                .catch(err => {
                                    numberOfFilesRemaining--;
                                    if (err.message.includes('EBUSY')) {
                                        reportProgress(sourceFiles[i], 'IN GEBRUIK - OVERGESLAGEN');
                                    } else {
                                        reportProgress(sourceFiles[i], 'ERROR');
                                        errors = true;
                                    }
                                });
                            }
                        }
                        // Remove all unused files
                        for (let i in filesToBeDeleted) {
                            fs.remove(`${syncPath}/${filesToBeDeleted[i]}`)
                            .then(() => {
                                numberOfFilesRemaining--;
                                reportProgress(filesToBeDeleted[i], 'DELETED');
                            })
                            .catch(() => {
                                numberOfFilesRemaining--;
                                reportProgress(filesToBeDeleted[i], 'ERROR DELETING');
                            });
                        }    
                    });
                });
            });
        }
    }

    // Emit message
    message(line) {
        let message = {
            title: 'Melding',
            text: line,
            ok: true
        }
        io.to(this.activeSession).emit('message', message);
    }

    // Get project status
    status() {
        util.log(`Project Name: ${this.name} - Socket Room: ${this.activeSession}`);
    }
}

module.exports = Project;
