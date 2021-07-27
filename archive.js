const fs = require('fs-extra');
const util = require('util');

class Archive {
    constructor(archivePath) {
        this._archivePath = archivePath;
        this._projectsList = [];
        this.list();
    }

    // Getters and setters
    set projectsList(value) {
        this._projectsList = value;
    }
    get projectsList() {
        return this._projectsList;
    }
    get archivePath() {
        return this._archivePath;
    }

    // Get current date format in yyyy-mm-dd
    static formatDate() {
        const d = new Date();
        let month = d.getMonth() + 1;
        let day = d.getDate();
        const year = d.getFullYear();
    
        if (month < 10) 
            month = '0' + month;
        if (day < 10) 
            day = '0' + day;
    
        return [year, month, day].join('-');
    }

    // List all archived projects
    list() {
        fs.readdir(this.archivePath, { withFileTypes: true })
        .then((directoryListing) => {
            // Filter on directories
            const projects = directoryListing
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
            this.projectsList = projects;
        })
        .catch((error) => {
            util.log(`Error listing files in archive: ${error.name}`);
        });        
    }
    
    // Export project to archive
    export(projectName) {
        const dateString = Archive.formatDate();
        const sourcePath = `${appRoot}\\public\\presentation\\${projectName}`;
        const destinationPath = `${this.archivePath}\\${dateString} ${projectName}`;
        fs.copy(sourcePath, destinationPath, { overwrite: true })
        .then(() => {
            this.list();
            util.log(`Archived ${projectName} to ${destinationPath}.`);
        })
        .catch((error) => {
            util.log(`Error archiving ${projectName}: ${error.name}.`);
        });
    }

    // Import project from archive
    import(projectName) {
        const sourcePath = `${this.archivePath}\\${projectName}`;
        const destinationPath = `${appRoot}\\public\\presentation\\${projectName.substring(11)}`;
        fs.copy(sourcePath, destinationPath, { overwrite: true })
        .then(() => {
            this.list();
            util.log(`Restored ${projectName} to ${destinationPath}.`);
        })
        .catch((error) => {
            util.log(`Error restoring ${projectName}: ${error.name}.`);
        });
    }
}

module.exports = Archive;