"use strict";

let socket = io();
let userName = '';
let pagePrepared = false;

function popUpMessage(message = null) {
    if (message === null)  {
        if ($('#dialog-message').dialog('instance') && $('#dialog-message').dialog('isOpen')) {
            $('#dialog-message').dialog('close');
        }
    } else {
        const modal = (message.modal ? message.modal : false);
        const height = (message.height ? message.height : 400);
        const width = (message.width ? message.width : 600);
        const dialogClass = (message.title ? 'no-close' : 'no-title');
        let buttons = {};
        if (message.ok) {
            buttons = {
                Ok: function() {
                    $(this).dialog("close");
                }
            }
        }

        $('#message').html(message.text);
        $('#dialog-message').dialog({
            dialogClass: dialogClass,
            width: width,
            height: height,
            maxWidth: 600,
            maxHeight: 600,
            title: message.title,
            modal: modal,
            buttons: buttons
        });
    }
}

$(function() {
    // Reconnect with TouchDesigner
    $('#reconnectButton').on('click', () => {
        // Send reconnect command to TouchDesigner
        socket.emit('sendToTouch', 'reconnect');
    });

    // Reset button to restart TouchDesigner
    $('#resetButton').on('click', () => {
        // Send reset command to TouchDesigner
        socket.emit('sendToTouch', 'reset');
    });

    // Projects button to retrieve list of projects from TouchDesigner
    $('#projectsButton').on('click', () => {
        // Send reset command to TouchDesigner
        socket.emit('sendToTouch', 'status');
    });

    // Jump to root button for TouchDesigner
    $('#rootButton').on('click', () => {
        // Send reset command to TouchDesigner        
        socket.emit('sendToTouch', 'root');
    });

    // Jump to root button for TouchDesigner
    $('#upButton').on('click', () => {
        // Send up command to TouchDesigner        
        socket.emit('sendToTouch', 'up');
    });

    // Jump to root button for TouchDesigner
    $('#downButton').on('click', () => {
        // Send down command to TouchDesigner        
        socket.emit('sendToTouch', 'down');
    });

    // Jump to root button for TouchDesigner
    $('#nextButton').on('click', () => {
        // Send next command to TouchDesigner        
        socket.emit('sendToTouch', 'next');
    });

    // Jump to root button for TouchDesigner
    $('#backButton').on('click', () => {
        // Send back command to TouchDesigner        
        socket.emit('sendToTouch', 'back');
    });

    // List archive
    socket.emit('getArchiveList');

    // Importeer project
    $('#importProject').on('click', () => {
        const project = $('#archiveList').val();
        socket.emit('importProject', project);
    });

    // Identify user
    userName = $('#userId').text();
    console.log('Identified... after finished page.');
    let idCard = {
        name: userName   
    }
    socket.emit('user', idCard);
    socket.emit('touchDesignerStatus');
});

socket.on('disconnect', function () {
    popUpMessage({
        title: 'Probleem',
        text: '<h3>Vebinding met server verbroken</h3>',
        modal: true,
        ok: false
    });
    socket.on('connect', function () {
        popUpMessage();     
    });
});
    
socket.on('whoAreYou', function() {
    if (pagePrepared) {
        console.log('Identified after whoAreYou');
        let idCard = {
            name: userName   
        }
        if (currentStatus.projectName) {
            idCard.project = currentStatus.projectName;
        }
        socket.emit('user', idCard);
    }
    console.log('Request for identification.');
});

socket.on('connected', function() {
    $('#touchDesignerStatus').html('Verbonden');
    $('#reconnectButton').html('Verbreek verbinding');
    socket.emit('sendToTouch', 'status');
    $('#controlPanel').show();
});

socket.on('disconnected', function() {
    $('#touchDesignerStatus').html('Geen verbinding');
    $('#reconnectButton').html('Maak verbinding');
    $('#controlPanel').hide();
});

socket.on('projects', function(status) {
    // Fill the presentations list
    $('#tdProjects').empty();
    const projects = status.projects;
    for (let i in projects) {
        if (projects[i] == status.currentProject) {
            $('#tdProjects').append(`<option value="${projects[i]}" selected>${projects[i]}</option>`);
        } else {
            $('#tdProjects').append(`<option value="${projects[i]}">${projects[i]}</option>`);
        }
    };
    $('#tdProjects').attr('size', projects.length);
    $('#tdProjects').css('height', 'auto');
    $('#tdProjects').off();
    $('#tdProjects').on('change', function() {
        console.log($(this).val());
        socket.emit('TD_project', $(this).val());
    });

    // Fill the page list
    $('#tdContainers').empty();
    const containers = status.containers;
    for (let i in containers) {
        if (containers[i] == status.currentContainer) {
            $('#tdContainers').append(`<option value="${containers[i]}" selected>${containers[i]}</option>`);
        } else {
            $('#tdContainers').append(`<option value="${containers[i]}">${containers[i]}</option>`);
        }
    };
    $('#tdContainers').attr('size', containers.length);
    $('#tdContainers').css('height', 'auto');
    $('#tdContainers').off();
    $('#tdContainers').on('change', function() {
        console.log('Page', $(this).val());
        socket.emit('TD_container', $(this).val());
    });

    // Create asset buttons simulating clicks on assets
    $('#tdAssets').empty();
    const assets = status.currentAssets;
    if (assets && assets.length > 0) {
        for (let i in assets) {
            $('#tdAssets').append(`<button id="assetButton_${i}">${assets[i]}</button><br />`);
            $(`#assetButton_${i}`).off();
            $(`#assetButton_${i}`).on('click', function() {
                socket.emit('TD_asset', assets[i]);
            });
        }
        $('#tdAssets').show();
    } else {
        $('#tdAssets').hide();        
    }
});

socket.on('archiveList', (archiveList) => {
    $('#archiveList').empty();
    for (let i in archiveList) {
        $('#archiveList').append(`<option value="${archiveList[i]}">${archiveList[i]}</option>`);
    }
});