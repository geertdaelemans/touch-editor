# INSTALLATION

## MongoDB
Get and install a free MongoDB instance at:
	https://www.mongodb.com/download-center/community

Start the server (all default values are ok, no need to fill in an URL).

## Adding a default user (adiminstator):
In the .deploy directory add the temporary file users.json containing (example):

```json
{
    "users": [
        {
            "username": "admin@vrt.be",
            "name": "Administrator",
            "role": 0,
            "password": "test"
        }
    ]
}
```

Role 0 is administrator, role 1 is editor.
This file will be deleted after initialisation.

## FFPMEG installation
Install both ffmpeg and ffprobe on the server computer. These must
be of a version higher or equal to 0.9.

Most probably ffmpeg and ffprobe will not be in your %PATH, so you
must set %FFMPEG_PATH and %FFPROBE_PATH.

## .env-file
Create an .env-file (no extension) containing following parameters:

```
SESSION_SECRET={the secret to hash passwords}
DATABASE_URL={link to MongoDB database, example: mongodb://localhost/vrttouch}
PORT={server port: 3000}
IMPORT_FOLDER={location of the dropfolder: \\rto.be\w\Toepassingen\VRT Touch}
IMPORT_TEMPLATES={location of the templates repository: D:\templates}
TOUCHDESIGNER_URL={server location: localhost}
TOUCHDESIGNER_PORT={server port: 9980}
```

## config.js
In a separate config.js file you can list all synchronisation targets:

```json
{
    "syncTargets": {
        "Nieuwsstudio": "D:\\TouchServer\\studio",
        "Nieuwsvloer": "D:\\TouchServer\\vloer"
    }
}
```

## npm
Install the required node.js packages via npm:

	npm install

# USAGE
Next start the Touchscreen server

	npm start

In your web browser, go to: http://localhost:{port}

Enjoy.

# DEV
To make use of gulp.js automatisation functionality you need
to install gulp globally (https://gulpjs.com/):

	npm install --global gulp-cli

To start gulp, just type gulp in command line.

# NODEMON
To automatically restart the server during development you can use
nodemon:

    npm install nodemon -g

Usage:
    nodemon

# FOREVER
To automatically restart the server after a crash you can use
forever:
    npm install forever -g

Usage:
    forever start server.js
    forever stopall             --> stops all current processes
    forever list                --> list all current processes

# GETTING GUI TO WORK ON SERVER WITH IIS
You can host the server on Windows with IIS as
reverse proxy. For this you need to configure the
system in the ISS Manager.
For more details see:
https://dev.to/petereysermans/hosting-a-node-js-application-on-windows-with-iis-as-reverse-proxy-397b

# UPLOADING LARGE FILES ON SERVER WITH IIS
Without taking any provisions, you get following error message while uploading big files through IIS:

    "The page was not displayed because the request entity is too large on IIS"

This can be remedied by following scenario:

    1. Go to IIS (type iis in command box).
    2. Click on the server name
    3. In the features (icons), chose the configuration editor.
    4. Click on the dropdowns on the top next to the word Section.
    5. Traverse the path system.webServer -> security -> requestFiltering.
    6. Go to requestLimits -> maxAllowedContentLength and set it to 334217728.
    7. Hit enter and then apply on the top right.
    
    You can also restart the webserver for good measure.
