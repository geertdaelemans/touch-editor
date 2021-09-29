const WebSocketClient = require('websocket').client;
const util = require('util');
const EventEmitter = require('events');

class TouchDesigner extends EventEmitter {
    constructor() {
        super();
        this._name = null;
        this._url = null;
        this._port = null;
        this._connected = null;
        this._client = null;
    }

    // Getters and setters
    set name(value) {
        this._name = value;
    }
    get name() {
        return this._name;
    }
    set url(value) {
        this._url = value;
    }
    get url() {
        return this._url;
    }
    set port(value) {
        this._port = value;
    }
    get port() {
        return this._port;
    }
    set connected(value) {
        this._connected = value;
        if (value) {
            this.emit('connected');
        } else {
            this.emit('disconnected');
        }
    }
    get connected() {
        return this._connected;
    }
    set client(value) {
        this._client = value;
    }
    get client() {
        return this._client;
    }

    // Initialize the TouchDesigner link
    init(name, url = "localhost", port = 9980) {
        this.name = name;
        this.url = url;
        this.port = port;
    }

    // Connect to TouchDesigner server
    connect() {
        const self = this;
        this.client = new WebSocketClient();
        this.client.on('connectFailed', function(error) {
            util.log('Connect Error 1: ' + error.toString());
        });
        this.client.on('connect', function(connection) {
            self.connected = true;
            connection.on('error', function(error) {
                self.connected = false;
                util.log(`Connection Error 2: ${error.toString()}`);
            });
            connection.on('close', function() {
                self.connected = false;
                self.removeAllListeners('reconnect');
                self.on('reconnect', () => {
                    self.connect();
                });
            });
            connection.on('message', function(message) {
                if (message.type === 'utf8') {
                    const returnJson = JSON.parse(message.utf8Data);
                    if (returnJson.projects) {
                        self.emit('projects', returnJson);
                    }
                    util.log(`Received status from TouchDesigner.`);
                }
            });
            
            // Assign the event handler to an event
            self.removeAllListeners('disconnect');
            self.on('disconnect', () => {
                connection.close();
            });
            self.removeAllListeners('reset');
            self.on('reset', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'reset' 
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('status');
            self.on('status', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'status' 
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('touchOn');
            self.on('touchOn', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'touch',
                        state: 'on'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('touchOff');
            self.on('touchOff', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'touch',
                        state: 'off'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('root');
            self.on('root', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'root'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('next');
            self.on('next', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'jumpPage',
                        page: 'next', 
            			transition: 'right'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('back');
            self.on('back', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'jumpPage',
                        page: 'back', 
            			transition: 'left'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('up');
            self.on('up', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'jumpPage',
                        page: 'up', 
            			transition: 'up'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('down');
            self.on('down', () => {
                if (connection.connected) {
                    let message = { 
                        command: 'jumpPage',
                        page: 'down', 
            			transition: 'down'
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('changeProject');
            self.on('changeProject', (project) => {
                if (connection.connected) {
                    let message = { 
                        command: 'changeProject',
                        project: project 
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('switchPage');
            self.on('switchPage', (page, transition = 'cut') => {
                if (connection.connected) {
                    let message = { 
                        command: 'jumpPage',
                        page: page,
                        transition: transition 
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('clickAsset');
            self.on('clickAsset', (asset) => {
                if (connection.connected) {
                    let message = { 
                        command: 'clickAsset',
                        page: asset
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
            self.removeAllListeners('injectField');
            self.on('injectField', (page, field, data) => {
                if (connection.connected) {
                    let message = { 
                        command: 'injectField',
                        page: page,
                        field: field,
                        data: data 
                    }
                    connection.sendUTF(JSON.stringify(message));
                }
            });
        });
        this.client.connect(`ws://${this.url}:${this.port}`);
    }

    disconnect() {
        this.emit('disconnect');
    }

    sendStatus() {
        if (this.connected) {
            this.emit('connected');
        } else {
            this.emit('disconnected');
        }
    }

    // Send commands to TouchDesigner server
    sendCommand(command) {
        if (command == 'reconnect' && this.connected === null) {
            // First connection after server start
            this.connect();
        } else if(command == 'reconnect' && this.connected) {
            this.disconnect();
        } else if(command == 'reconnect') {
            this.connect();
        } else {
            this.emit(command);
        }
    }

    // Change project
    changeProject(project) {
        this.emit('changeProject', project);
    }

    // Change project
    switchPage(page, transition) {
        this.emit('switchPage', page, transition);
    }

    // Click on an asset
    clickAsset(asset) {
        this.emit('clickAsset', asset);
    }

    injectField(page, field, data) {
        this.emit('injectField', page, field, data);
    }
}

module.exports = TouchDesigner;