# VRT Touch - Editor
In this repository, you can find the source code of the VRT Touch Editor component.

## Installation with docker
## Adding a default user (administrator):
Create a temporary .deploy directory. Add in this directory the file users.json containing (example):

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

### TEMPORARY WORKAROUND:
In the db directory a roles definition file has been added: roles.js. This defines the required roles.
Please use this file to import roles definition into MongoDB. Create a Collection with the name roles and then populate it with this file.
You can do this via the MongoDB GUI. Logged in Jira as: TOUCH-126.

## .env-file
Create an .env-file (no extension) containing following parameters (also see example.env):

```
SESSION_SECRET={the secret to hash passwords}
PORT={server port: 3000}
NODE_LOCAL_PORT=80
PATH_DROPFOLDER={location of the dropfolder: \\rto.be\w\Toepassingen\VRT Touch}
PATH_TEMPLATES={location of the templates repository: D:\templates}
PATH_ARCHIVE={location of the archive D://Archive}
TOUCHDESIGNER_URL={server location: localhost}
TOUCHDESIGNER_PORT={server port: 9980}
TWITTER_CONSUMER_KEY={YourConsumerKey}
TWITTER_CONSUMER_SECRET={YourConsumerSecret}
TWITTER_ACCESS_TOKEN={YourAccessTokenKey}
TWITTER_ACCESS_TOKEN_SECRET={YourAccessTokenSecret}


```

## config.json
In a separate config.json file you can list all synchronisation targets:

```json
{
    "syncTargets": {
        "Infostudio": { 
            "dataPath": "\\\\d25622\\vrt-touch-data",
            "url": "d25622",
            "port": 9980
        },
        "Webstudio": {
            "dataPath": "\\\\d25623\\vrt-touch-data",
            "url": "d25623",
            "port": 9980
        }
    }
}
```

## Running
`docker-compose up -d`

