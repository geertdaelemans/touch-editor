"use strict"; // Start of use strict

import { MD5 } from './lib/helper.js';
import Network from './lib/Network.js';
import Canvas from './lib/Canvas.js';
import Keyframes from './lib/Keyframes.js';
import History from './lib/History.js';

let sessionId = null;
let socket = io();
let currentStatus = {
    data: []
};
const RESOLUTION_OPTIONS = {
    "HD Horizontaal": {
        "canvasWidth": 1920,
        "canvasHeight": 1080
    },
    "HD Verticaal": {
        "canvasWidth": 1080,
        "canvasHeight": 1920        
    }
}

const network = new Network();

class Page {
    constructor() {
        this._index = null;
        this._data = {};
        this._template = {};
        this._templateBackup = {};
        this._layers = [];
        this._activeAsset = null;
        this._updated = false;
    }
    // Getters and setters
    get index() {
        return this._index;
    }
    set index(value) {
        if (this.updated) {
            this.save();
        }
        this._index = value;
        this.loadCurrentPage();
        this.updated = false;
    }
    get data() {
        return this._data;
    }
    set data(value) {
        this._data = value;
    }
    get template() {
        return this._template;
    }
    set template(value) {
        this._template = value;
    }  
    get templateBackup() {
        return this._templateBackup;
    }
    set templateBackup(value) {
        this._templateBackup = value;
    }
    get layers() {
        return this._layers;
    }
    set layers(value) {
        this._layers = value;
    }
    get activeAsset() {
        return this._activeAsset;
    }
    set activeAsset(value) {
        this._activeAsset = value;
    }     
    get updated() {
        return this._updated;
    }
    set updated(value) {
        $('#undoButton').toggle(value);
        $('#saveButton').toggle(value);
        this._updated = value;
    }
    reset() {
        // Stop and remove all video's
        $("video").each(function() {
            $(this).get(0).pause();
        });
        $("video").remove();
        $('#videoControl').hide();
        this.data = {};
        this.template = new Template();
        this.template.draw();
        this.layers.length = 0;
        // Remove the drawing aids
        drawNavigationAids();
    }
    loadCurrentPage() {
        if (currentStatus.data[this.index]) {
            this.data = JSON.parse(JSON.stringify(currentStatus.data[this.index]));
            this.templateBackup = JSON.parse(JSON.stringify(new Template()));
        }
    }
    undo() {
        this.template = new Template(this.templateBackup.template);
        this.updated = false;
        if (this.templateBackup.fields) {
            this.template.fields = JSON.parse(JSON.stringify(this.templateBackup.fields));
        }
        this.loadCurrentPage();
        showPageInfo();
        if (this.activeAsset !== null) {     
            refreshAsset(this.activeAsset);
        }
        drawPage();
        drawNavigationAids();
    }
    makeSnapShot() {
        const pageId = this.index;
        const pageName = this.data.id;
        this.template.resetAnimation();
        html2canvas(document.querySelector('#screenshotArea'), { backgroundColor: '#000000', scale: 1 })
        .then(canvasExport => {
            const image = canvasExport.toDataURL('image/png');
            socket.emit('saveScreenShot', pageName, image);
            $(`#page_${pageId}`).children('img').attr('src', image);
        });        
    }
    save() {
        if (this.index >= 0) {
            // TODO: Move this clean-up to server
            delete this.data.unSaved;
            if (this.data.template == '') {
                delete this.data.template;
            }
            if (this.data.asset) {
                for (let i in this.data.asset) {
                    if (this.data.asset[i].zoom == '') {
                        delete this.data.asset[i].zoom;
                    }
                    if (this.data.asset[i].loop == '') {
                        delete this.data.asset[i].loop;
                    }
                    if (this.data.asset[i].keyframes == '') {
                        delete this.data.asset[i].keyframes;
                    }
                }
            }
            if (this.data.annotate == '' || this.data.annotate == '[NONE]') {
                delete this.data.annotate;
            }
            console.log(this.data);
            socket.emit('savePage', this.data, this.index);
            // Sending a screenshot to the server
            this.makeSnapShot();
            this.updated = false;
        }
    }
    // Swap the order of pages
    swap(pageIndex1, pageIndex2) {
        if(this.updated) {
            this.save();
        }
        console.log(`Switch pages ${pageIndex1} and ${pageIndex2}.`);
        socket.emit('swapPage', pageIndex1, pageIndex2);
        const temp = currentStatus.pageIds[pageIndex1];
        currentStatus.pageIds[pageIndex1] = currentStatus.pageIds[pageIndex2];
        currentStatus.pageIds[pageIndex2] = temp;
        const temp1 = currentStatus.data[pageIndex1];
        currentStatus.data[pageIndex1] = currentStatus.data[pageIndex2];
        currentStatus.data[pageIndex2] = temp1;
        if (pageIndex1 == this.index) {
            this.index = pageIndex2;
        } else if (pageIndex2 == this.index) {
            this.index = pageIndex1;
        }
        displayPagesBar();
    }
    // Move page exactly behind another page
    move(pageIndex1, pageIndex2) {
        if(this.updated) {
            this.save();
        }    
        console.log(`Move page ${pageIndex1} exactly behind ${pageIndex2}.`);
        socket.emit('movePage', pageIndex1, pageIndex2);
    }
    clearLayers() {
        for (let i in this.layers) {
            this.layers[i] = undefined;
        }
        this.layers.length = 0;
    }
    removeAsset(assetId) {
        this.data.asset.splice(assetId, 1);
        this.layers.splice(parseInt(assetId) + 1, 1);
        this.updated = true;
        this.activeAsset = null; 
    }
}
let curPage = new Page();

class Projects {
    constructor() {
        this._projectsArray = [];
    }
    set list(value) {
        this._projectsArray = value;
    }
    get list() {
        return this._projectsArray;
    }
    
    // Helper function to create a project button with all handlers in GUI.
    createButton(name, projectsData) {
        let subSectionSelector = 'projects';
        let projectSelector = `project_${name.split(' ').join('_')}`;
        if (projectsData[name].owner == userName) {
            subSectionSelector = 'privateProjects';
        }
        let projectScreenShot;
        if (projectsData[name].screenshot.filename.startsWith('/')) {
            projectScreenShot = `${projectsData[name].screenshot.filename}`;
        } else {
            projectScreenShot = `${currentStatus.presentationFolder + name}/screenshots/${projectsData[name].screenshot.filename}?t=${new Date().getTime()}`;
        }
        const buttonHtml = `<div class="projectButton" id="${projectSelector}" name="${name}"><div class="projectName">${name}</div><img src="${projectScreenShot}" class="projectScreenShot" /><div class="locked"></div></div>`;
        let insertNeeded = false
        let itemPointer = null;
        // Search button with name alphabetically direct after name to be inserted
        $(`#${subSectionSelector}`).children('div:not(.addButton)').each(function() {
            itemPointer = this;
            if (projectSelector < this.id) {
                insertNeeded = true;
                return false;
            }
        });
        $(`#${subSectionSelector}`).append(buttonHtml);
        if (insertNeeded) {
            if (itemPointer) {            
                $(`#${projectSelector}`).insertBefore($(itemPointer));
            } else {
                $(`#${projectSelector}`).appendTo($(`#${subSectionSelector}`));
            }                               
        } else {
            if (itemPointer) {
                $(`#${projectSelector}`).insertAfter($(itemPointer));
            } else {
                $(`#${projectSelector}`).appendTo($(`#${subSectionSelector}`));
            }
        }
        $(`#${projectSelector}`).off();
        // Handle left click on project button
        $(`#${projectSelector}`).on('click', function(event) {
            event.preventDefault();
            popUpMessage({
                text: '<h1>Loading...</h1>',
                height: 100,
                width: 250
            });
            socket.emit('changeProject', name);
        });

        // Handle right click on project button
        $(`#${projectSelector}`).on('contextmenu', function(event) {
            event.preventDefault();
            if (currentStatus.projectName != name) {
                settingsOnly = true;  // TODO this should be avoided by limiting the data sent to client
                socket.emit('changeProject', name);
            }
            // Hide all right menu bar items
            $('#pageInfo').hide();
            $('#fieldsInfo').hide();
            $('#assetInfo').hide();
            // Toggle right menu bar
            toggleRightBar(false);
            $('#projectSettings').dialog({
                dialogClass: "no-close",
                width: 600,
                height: 400,
                maxWidth: 600,
                maxHeight: 600,
                title: 'Projectinstellingen',
                modal: false,
                buttons: {
                    OK: function() {
                        // Retrieve all settings after submit
                        const settings = {
                            projectName: $('#projectName').val(),
                            canvasWidth: $('#canvasWidth').val(),
                            canvasHeight: $('#canvasHeight').val(),
                            transitionSpeed: $('#transitionSpeed').val()
                        };
                        // Make sure that after submitting the settings fields are correct
                        // A status will be broadcasted, but this might not be in time for the refresh
                        currentStatus.canvasWidth = settings.canvasWidth;
                        currentStatus.canvasHeight = settings.canvasHeight;
                        currentStatus.transitionSpeed = settings.transitionSpeed;
                        // Handle the private checkbox
                        if ($('#private').is(':checked')) {
                            settings.owner = userName;
                            currentStatus.owner = userName;
                        } else {
                            currentStatus.owner = '';
                        }
                        // Emit the settings only
                        socket.emit('changeSettings', settings);
                        $(this).dialog("close");
                    },
                    Annuleren: function() {
                        $(this).dialog("close");
                    }
                }
            });
        });
    }
        
    // Helper function to move a button to the private or public area in GUI
    moveButton(name, toPrivate = true) {
        const targetSelector = toPrivate ? $('#privateProjects') : $('#projects');
        const projectSelector = $(`#project_${name.split(' ').join('_')}`);
        let insertNeeded = false
        let itemPointer = null;
        // Move back to public or private project list
        // Search button with name alphabetically direct after name to be inserted
        targetSelector.children('div:not(.addButton)').each(function() {
            itemPointer = this;
            if (projectSelector.attr('id') < this.id) {
                insertNeeded = true;
                return false;
            }
        });
        // Insert the item before next or after last item
        if (insertNeeded) {
            projectSelector.insertBefore($(itemPointer));
        } else {
            if (itemPointer) {
                projectSelector.insertAfter($(itemPointer));
            } else {
                projectSelector.appendTo(targetSelector);
            }
        }
    }

    // Display the list of projects in GUI
    listProjects(update = null) {    
        if (currentStatus.presentationFolder) {
            // Filter projects on authorisation
            // In the meantime collect array of updated buttons for later use
            let updatedButtonArray = [];
            for (let projectName in update) {
                if (update[projectName].owner && update[projectName].owner != userName) {
                    delete update[projectName];
                } else {
                    updatedButtonArray.push(projectName);
                }
            }
            // Sort the buttons for correct display
            updatedButtonArray.sort();
            // Delete buttons that are not included in the update
            // In the meantime collect array of current buttons for later use
            let currentButtonArray = [];
            $('#projects,#privateProjects').children('div:not(.addButton)').each(function() {
                if (!update.hasOwnProperty($(this).attr('name'))) {
                    $(this).remove();
                } else {
                    currentButtonArray.push($(this).attr('name'));
                }
            });
            // Update all buttons based upon the sorted button array
            for (let i in updatedButtonArray) {
                const projectName = updatedButtonArray[i];
                const oldItem = projects.list[projectName];
                const oldOwner = ((oldItem && oldItem.owner) ? oldItem.owner : '');
                const newOwner = (update[projectName].owner ? update[projectName].owner : '');
                // Check if the button is already displayed
                const found = currentButtonArray.indexOf(projectName) != -1;
                if (found) {
                    // Move button between public and private, if needed
                    if (newOwner != oldOwner) {
                        this.moveButton(update[projectName].name, newOwner != '');
                    }
                    const oldTimestamp = (oldItem ? projects.list[update[projectName].name].screenshot.timestamp : '');
                    const newTimestamp = update[projectName].screenshot.timestamp;
                    if (newTimestamp != oldTimestamp) {
                        const projectSelector = `project_${update[projectName].name.split(' ').join('_')}`;
                        const projectScreenShot = `${currentStatus.presentationFolder + projectName}/screenshots/${update[projectName].screenshot.filename}?t=${new Date().getTime()}`;
                        $(`#${projectSelector} .projectScreenShot`).attr('src', projectScreenShot);
                    }                
                } else {
                    this.createButton(update[projectName].name, update);
                }
                // Set correct locked state
                const projectSelector = `project_${update[projectName].name.split(' ').join('_')}`;
                $(`#${projectSelector} .locked`).html(update[projectName].locked ? update[projectName].locked : '');
                // Make the clicked button active 
                if (update[projectName].name == currentStatus.projectName) {
                    $('#privateProjects, #projects').children().removeClass('active');
                    $(`#${projectSelector}`).addClass('active');
                }
            }
            // Display or hide private projects
            $('#privateLabel').toggle($('#privateProjects').children().length > 0);
    
            // Update the projects list maintained in client
            projects.list = update;
    
            // Cover case when no project screenshot is found
            $('.projectScreenShot').on('error', function() {
                // Replacing image source
                $(this).attr('src', '/img/blankProject.jpg');
            });
    
            // Add new project button
            if (!$("#project_x").length) {
                // Add a new project button
                $('#projects').append('<div class="projectButton addButton" id="project_x"><img src="/img/add-icon.png" /></div>');
    
                // Add listener to create project
                $('#project_x').on('click', function() {
                    socket.emit('createProject');
                });
            }
    
            // Update project details
            if (currentStatus.projectName) {
                $('#projectName').val(currentStatus.projectName);
                $('#resolution').empty();
                let selectedType = "Custom";
                for (let type in RESOLUTION_OPTIONS) {
                    $('#resolution').append(`<option value="${type}">${type}</option>`);
                    if (currentStatus.canvasWidth == RESOLUTION_OPTIONS[type].canvasWidth && 
                        currentStatus.canvasHeight == RESOLUTION_OPTIONS[type].canvasHeight) {
                        selectedType = type;
                    }
                }
                $('#resolution').append(`<option value="Custom">Aangepast</option>`);
                $('#resolutionDetails').toggle(selectedType == "Custom");
                $('#resolution').val(selectedType);
                $('#canvasWidth').val(currentStatus.canvasWidth);
                $('#canvasHeight').val(currentStatus.canvasHeight);
                $('#transitionSpeed').val(currentStatus.transitionSpeed);
                $('#private').prop('checked', currentStatus.owner ? true : false);
            }
            $('#resolution').off();
            $('#resolution').on('change', function() {
                const type = $(this).val();
                if (type != "Custom") {
                    $('#canvasWidth').val(RESOLUTION_OPTIONS[type].canvasWidth);
                    $('#canvasHeight').val(RESOLUTION_OPTIONS[type].canvasHeight);
                    $('#resolutionDetails').hide();
                } else {
                    $('#resolutionDetails').show();
                }
            });
        }
    }    
}

const history = new History();
let projects = new Projects();
const canvas = new Canvas('canvas');

let shapes = [];
let userName = '';
let pagePrepared = false;
let moving = false;
let refX, refY = null;
let settingsOnly = false;
let currentTab = null;

const NO_MEDIA_IMAGE = "/img/no-media.png";
const LIVE_VIDEO_IMAGES = ["/img/live-stream-1.png", "/img/live-stream-2.png", "/img/live-stream-3.png"];
const LIVE_VIDEO_TAGS = ["[LIVE]", "[LIVE2]", "[LIVE3]"];
const TRANSITIONS = {
    'none': 'Geen',
    'fade': 'Fade',
    'right': 'Rechts',
    'left': 'Links',
    'up': 'Op',
    'down': 'Neer'
}

// Check if filename indicates that it is a video
function isVideo(fileName) {
    if (fileName) {
        try {
            const extension = fileName.split('.').pop().toLowerCase();
            const videoExtensions = ['mp4', 'mov'];
            if (videoExtensions.includes(extension)) {
                return true;
            }
        } catch(error) {
            return false;
        }
    }
    return false;
}

// Show or hide subsections from right menu bar
function showSubSection(subSection, speed = 'fast') {
    const subSections = ['pagina', 'asset', 'fields'];
    for (let i in subSections) {
        if (subSection == subSections[i]) {
            $(`#${subSections[i]}Form`).slideDown(speed);
        } else {
            $(`#${subSections[i]}Form`).slideUp(speed);
        }
    }
}

// Get cookie parameter
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

$(function() {

    /*
     * Avoid standard context menu's
     */    
    $('body').on('contextmenu', function(event) {
        event.preventDefault();
    });

    $('#dialog-message').hide();
    $('#projectSettings').hide();
    $('#menu-toggle').show();
    $('#sidebarToggle').show();

    /* 	
     * Tabs switching mechanism 
     */
    $('.tab-content:first-child').show();
    $('.left-menu').on('click', function() {
        let tab = $(this).data("target"); // get the target from data attribute
        switchToTab(tab);
    });

    /* 	
     * Hide all edit buttons on left menu bar 
     */
    $('#viewerButton').hide();
    $('#templatesButton').hide();    
    $('#mediaButton').hide(); 
    $('#networkButton').hide();
    $('#xmlButton').hide();
    $('#syncButton').hide();
    $('#archiveButton').hide();
    $('#undoButton').hide();
    $('#undoButton').off();
    $('#undoButton').on('click', () => {
        curPage.undo();
        $('#saveButton').fadeOut();
        $('#undoButton').fadeOut();
    });
    $('#saveButton').hide();
    $('#saveButton').off();
    $('#saveButton').on('click', () => {
        curPage.save();
        $('#saveButton').fadeOut();
        $('#undoButton').fadeOut();
    });
    $('#snapshotButton').on('click', () => {
        curPage.makeSnapShot();
    });

    /* 	
     * Hide all buttons on right menu bar 
     */
    $('#paginaToggle').on('click', function() {
        showSubSection('pagina');
    });
    $('#assetToggle').on('click', function() {
        showSubSection('asset');
    });
    $('#fieldsToggle').on('click', function() {
        showSubSection('fields');
    });

    /* 	
     * Projects Page 
     */
    $('#privateLabel').hide();

    /* 	
     * Editor Page 
     */
    $('#canvas').hide();
    $('#editView').hide();
    $('#getTweet').hide();
    toggleRightBar(false);
    $('#assetInfo').hide();
    $('#pageInfo').hide();
    $('#videoControl').hide();
    $('#zoomSlider').slider({
        range: "min",
        min: 0,
        max: 100,
        value: 100,
        slide: function(event, ui) {
            const newScale = ui.value;
            canvas.resize(newScale);
        }
    });

    // Sliders for positioning assets
    $('#xSlider').slider({
        range: "min",
        min: 0,
        max: 1000,
        value: 500,
        slide: function(event, ui) {
            let newXpos = Math.floor(ui.value * currentStatus.canvasWidth / 1000);
            $("#xpos").val(newXpos);
            curPage.data.asset[curPage.activeAsset].xpos = newXpos;
            curPage.updated = true;
            refreshAsset(curPage.activeAsset);
        }
    });
    $('#xpos').val($('#xSlider').slider('value'));
    $('#ySlider').slider({
        range: "min",
        min: 0,
        max: 1000,
        value: 500,
        slide: function(event, ui) {
            let newYpos = Math.floor(ui.value * currentStatus.canvasHeight / 1000);
            $("#ypos").val(newYpos);
            curPage.data.asset[curPage.activeAsset].ypos = newYpos;
            curPage.updated = true;
            refreshAsset(curPage.activeAsset);
        }
    });
    $('#ypos').val($('#ySlider').slider('value'));
    $('#scaleSlider').slider({
        range: "min",
        min: 0,
        max: 100,
        value: 100,
        slide: function(event, ui) {
            let newScale = ui.value;
            $("#scale").val(newScale);
            curPage.data.asset[curPage.activeAsset].scale = newScale / 100;
            curPage.updated = true;
            refreshAsset(curPage.activeAsset);
        }
    });
    $('#scale').val($('#scaleSlider').slider('value'));

    // Video control
    const videoSlider = document.getElementById('videoSlider');
	noUiSlider.create(videoSlider, {
		start: [0, 50, 100],
        tooltips: [false, true, false],
        behaviour: 'tap',
        range: {
            'min': 0,
            'max': 100
        },
		connect: [false, true, true, false]
	});

    /* 	
     * XML Page 
     */
    // Add listener for saving XML edits
    $('#saveXml').on('click', function() {
        let xmlData = $('#xmlView').val();
        socket.emit('saveXml', xmlData);
    });

    $('#xmlViewButton').on('click', function() {
        $('#json-area').hide();
        $('#xml-area').show();
    });

    $('#jsonViewButton').on('click', function() {
        $('#xml-area').hide();
        $('#json-area').show();
    });

    // Clear the custom menu when user clicked somewhere else
    $(this).on('mousedown', function(event) {

        // If the clicked element is not the menu
        if (!$(event.target).parents('#popup').length > 0) {

            // Hide it
            $('#popup').hide(100);
        }
    });

    // Toggle the side navigation
    $('#sidebarToggle').on('click', function(event) {
        event.preventDefault();
        $("#page-content-wrapper").toggleClass("sidebar-left-toggled");
        $("#sidebar-left").toggleClass("toggled");
        canvas.resize();
    });

    // Prevent the content wrapper from scrolling when the fixed side navigation hovered over
    $('body.fixed-nav #sidebar-left').on('mousewheel DOMMouseScroll wheel', function(event) {
        if ($(window).width() > 768) {
            let e0 = event.originalEvent,
                delta = e0.wheelDelta || -e0.detail;
            this.scrollTop += (delta < 0 ? 1 : -1) * 30;
            event.preventDefault();
        }
    });

    // Scroll to top button appear
    $(document).on('scroll', function() {
        let scrollDistance = $(this).scrollTop();
        if (scrollDistance > 100) {
            $('.scroll-to-top').fadeIn();
        } else {
            $('.scroll-to-top').fadeOut();
        }
    });

    // Smooth scrolling using jQuery easing
    $(document).on('click', 'a.scroll-to-top', function(event) {
        let $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: ($($anchor.attr('href')).offset().top)
        }, 1000, 'easeInOutExpo');
        event.preventDefault();
    });

    // Prevent the content wrapper from scrolling when the fixed side navigation hovered over
    $('body.fixed-nav #sidebar-left').on('mousewheel DOMMouseScroll wheel', function(event) {
        if ($(window).width() > 768) {
            let e0 = event.originalEvent,
                delta = e0.wheelDelta || -e0.detail;
            this.scrollTop += (delta < 0 ? 1 : -1) * 30;
            event.preventDefault();
        }
    });

    // Scroll to top button appear
    $(document).on('scroll', function() {
        let scrollDistance = $(this).scrollTop();
        if (scrollDistance > 100) {
            $('.scroll-to-top').fadeIn();
        } else {
            $('.scroll-to-top').fadeOut();
        }
    });

    // Smooth scrolling using jQuery easing
    $(document).on('click', 'a.scroll-to-top', function(event) {
        let $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: ($($anchor.attr('href')).offset().top)
        }, 1000, 'easeInOutExpo');
        event.preventDefault();
    });

    // Right Menubar
    $('#menu-toggle').on('click', function(event) {
        event.preventDefault();
        toggleRightBar();
    });

    $(window).on('resize', function() {
        if($(window).width()<=768){
            toggleRightBar(false);
        }
    });

    pagePrepared = true;

    // Identify user
    userName = $('#userId').text();
    console.log('Identified... after finished page.');
    let idCard = {
        name: userName   
    }
    if (currentStatus.projectName) {
        idCard.project = currentStatus.projectName;
    }
    if (sessionId) {
        idCard.sessionId = sessionId;
    }
    socket.emit('user', idCard);

    switchToTab('projects');
});



(function($, sr) {

    // debouncing function from John Hann
    // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
    let debounce = function(func, threshold, execAsap) {
            let timeout;

            return function debounced() {
                let obj = this,
                    args = arguments;

                function delayed() {
                    if (!execAsap)
                        func.apply(obj, args);
                    timeout = null;
                };

                if (timeout)
                    clearTimeout(timeout);
                else if (execAsap)
                    func.apply(obj, args);

                timeout = setTimeout(delayed, threshold || 100);
            };
        }
        // smartresize 
    jQuery.fn[sr] = function(fn) { return fn ? this.on('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery, 'smartresize');

// Take action when user resizes the window
$(window).smartresize(function() {
    canvas.zoomToFit();
    drawPage();
    network.drawNetwork(switchToPageById);
});

function switchToPageById(id) { 
    switchPage(currentStatus.pageIds[id]);
    switchToTab('viewer');
}

socket.on('xml', function(msg, json) {
    $('#xmlView').val(msg);
    $('#jsonView').val(JSON.stringify(json, undefined, 4));
});

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


function toggleRightBar(onOff) {
    if (onOff == undefined) {
        $("#sidebar-right").toggleClass("toggled");
        $("#page-content-wrapper").toggleClass("sidebar-right-toggled");
    } else if (onOff == true) {
        $("#sidebar-right").addClass("toggled");
        $("#page-content-wrapper").addClass("sidebar-right-toggled");
    } else {
        $("#sidebar-right").removeClass("toggled");
        $("#page-content-wrapper").removeClass("sidebar-right-toggled");
    }
}

// Synchronize project with selected target server
function syncProject() {
    // More than one tartget available -> ask user to make a selection
    if (currentStatus.syncTargets.length > 1) {
        $('#message').empty();
        for (let i in currentStatus.syncTargets) {
            $('#message').append(`<button id="target_${i}" class="syncTarget">${currentStatus.syncTargets[i]}</button>`);
            $(`#target_${i}`).off();
            $(`#target_${i}`).on('click', function() {
                socket.emit('syncProject', currentStatus.syncTargets[i]);
            });
        }
        $('#dialog-message').dialog({
            dialogClass: "no-close",
            width: 600,
            height: currentStatus.syncTargets.length * 64 + 140,
            maxWidth: 600,
            maxHeight: 600,
            title: 'Selecteer synchronisatie doel',
            modal: false,
            buttons: {
                Annuleren: function() {
                    $(this).dialog("close");
                }
            }
        });
    // Only one target is available -> start sync immediately
    } else if (currentStatus.syncTargets.length == 1) {
        socket.emit('syncProject', currentStatus.syncTargets[0]);
    }
}

// Archive project 
function archiveProject() {
    socket.emit('archiveProject', currentStatus.projectName);
    $('#message').html(`<h1>Project <i>"${currentStatus.projectName}"</i> succesvol gearchiveerd.</h1>`);
    $('#dialog-message').dialog({
        dialogClass: "no-close",
        width: 600,
        height: 250,
        maxWidth: 600,
        maxHeight: 600,
        title: 'Archiveren',
        modal: false,
        buttons: {
            OK: function() {
                $(this).dialog("close");
            }
        }
    });
}

// Switch between tabs (projects, viewer, media, xml)
function switchToTab(tab) {
    if (tab == 'media') {
        if ($('#tab-media').dialog('instance') && $('#tab-media').dialog('isOpen')) {
            $('#tab-media').dialog('close');
        } else {
            $('#tab-media').dialog({
                width: 600,
                height: $(window).height() * 0.75,
                maxWidth: $(window).width(),
                maxHeight: $(window).height(),
                title: 'Media',
                modal: false,
                buttons: {
                    'Voeg media toe': function() {
                        $('input[name="newMedia"]').trigger('click');
                        $('.progress-bar').text('0%');
                        $('.progress-bar').width('0%');
                    },
                    'Opruimen': function() {
                        socket.emit('cleanOutMedia');
                    },
                    'Sluiten': function() {
                        $(this).dialog('close');
                    }
                }
            }).dialogExtend({
                closable: true,
                minimizable: true,
                collapsable:true,
                dblclick: "collapse",
                icons: {// jQuery UI icon class
                    close: "ui-icon-close",
                    minimize: "ui-icon-minus",
                    collapse: "ui-icon-triangle-1-s",
                    restore: "ui-icon-arrow-4-diag"
                }
            });
        }
    } else if (tab == 'sync') {
        syncProject();
    } else if (tab == 'archive') {
        archiveProject();
    } else if (tab == 'help') {
        window.open('/help','_blank');
    } else if (tab != currentTab) {
        let previousTab = currentTab;
        currentTab = tab;
        if (curPage.updated && previousTab == 'viewer') {
            curPage.save();
        }
        let $button = $('#' + tab + 'Button');
        $button.siblings().removeClass('active');
        $button.addClass('active');
        const $target = $('#tab-' + tab);
        $target.siblings().css("display", "none");
        $target.fadeIn("fast");
        if (tab == 'projects') {
            $('#pageInfo').hide();
            $('#fieldsInfo').hide();
        }
        if (tab == 'viewer') {
            $('#editView').show();
            $('#snapshotButton').show();
        } else {
            $('#editView').hide();
            $('#snapshotButton').hide();
        }
        if (tab == 'projects' || tab == 'network' || tab == 'xml') {
            toggleRightBar(false);
        }
        if (tab == 'viewer') {
            drawPage();
        } else if (tab == 'network') {
            network.drawNetwork(switchToPageById);
        }
    }
}

// Define shape (active area) - returns true/false
function defineShape(shape) {
    if (shape) {
        let points = shape.points;
        canvas.context.beginPath();
        canvas.context.moveTo(points[0].x, points[0].y);
        for (let i in points) {
            canvas.context.lineTo(points[i].x, points[i].y);
        }
        canvas.context.lineTo(points[0].x, points[0].y);
        return true;
    } else {
        return false;
    }
}

// Setup canvas
function setupCanvas() {
    // Resize canvas in respect to available window space
    canvas.setSize(currentStatus.canvasWidth, currentStatus.canvasHeight);
    canvas.resize();

    // Clear the canvas listeners
    $('#canvas').off();

    // Switch off default context menu
    $('#canvas').on('contextmenu', function() {
        return false;
    });

    // Listen for mousedown events
    $('#canvas').on('mousedown', function(event) {
        event.preventDefault();

        // Do not accept any mouse clicks on an empty presentation
        if  (curPage.index < 0) {
            return;
        }

        // Get mouse position
        const mouseX = Math.floor(event.clientX - canvas.left);
        const mouseY = Math.floor(event.clientY - canvas.top);

        // To catch case when not clicked on asset
        let clickedOnAsset = false;

        // Open menu with right-click
        if (event.button == 2) {
            toggleRightBar();
            $('#assetInfo').hide();
            $('#videoControl').hide();
        }

        // Iterate each shape in the shapes array
        for (let i in shapes) {
            let shape = shapes[i];
            if (defineShape(shape)) {
                // Test if the mouse is in the current shape
                if (canvas.context.isPointInPath(mouseX, mouseY)) {
                    // When left-click detected...
                    if (event.button == 0) {
                        // When in 'edit' mode, start asset movement
                        if (curPage.activeAsset == i) {
                            if (!moving) {
                                moving = true;
                                refX = mouseX;
                                refY = mouseY;
                                this.style.cursor = 'grab';
                            }
                            clickedOnAsset = true;
                        // When not in 'edit' mode, follow the presentation
                        } else if(!curPage.activeAsset) {
                            if (curPage.layers[parseInt(i) + 1].type == 'video') {
                                if (curPage.layers[parseInt(i) + 1].loop) {
                                    switchPage(curPage.data.asset[i].url);
                                } else if (curPage.layers[parseInt(i) + 1].isPaused()) {
                                    if (curPage.layers[parseInt(i) + 1].keyFrames.next() == -1) {
                                        switchPage(curPage.data.asset[i].url);
                                    } else {
                                        history.addKeyframeToHistory(curPage.index, parseInt(i), curPage.layers[parseInt(i) + 1].getCurrentTime());
                                        curPage.layers[parseInt(i) + 1].play();
                                    }
                                } else {
                                    curPage.layers[parseInt(i) + 1].jumpTo(curPage.layers[parseInt(i) + 1].keyFrames.next());
                                    if (curPage.layers[parseInt(i) + 1].keyFrames.next() == -1) {
                                        switchPage(curPage.data.asset[i].url);
                                    } else {
                                        history.addKeyframeToHistory(curPage.index, parseInt(i), curPage.layers[parseInt(i) + 1].getCurrentTime());
                                        curPage.layers[parseInt(i) + 1].play();
                                    }
                                }
                            } else {
                                switchPage(curPage.data.asset[i].url);
                            }
                            clickedOnAsset = true;
                        }
                    // When right-click dectected, draw border around asset
                    } else if (event.button == 2) {
                        if (curPage.activeAsset != i) {
                            if (curPage.layers[parseInt(i) + 1].type == 'video') {
                                curPage.layers[parseInt(i) + 1].editing = true;
                            }                            
                            refreshAsset(i);
                            toggleRightBar(true);
                            this.style.cursor = 'grab';
                        } else {
                            if (curPage.activeAsset && curPage.layers[parseInt(curPage.activeAsset) + 1].type == 'video') {
                                curPage.layers[parseInt(curPage.activeAsset) + 1].editing = false;
                            }
                            curPage.activeAsset = null;
                            canvas.context.beginPath(); // Clear active region
                            this.style.cursor = 'default';
                        }
                        clickedOnAsset = true;
                    }
                    break;
                }
            }
        }

        // Catch actions when not clicked on asset
        if (!clickedOnAsset) {
            // When click detected, clear highlights (leave 'edit' mode)
            if (curPage.activeAsset && curPage.layers[parseInt(curPage.activeAsset) + 1].type && curPage.layers[parseInt(curPage.activeAsset) + 1].type == 'video') {
                curPage.layers[parseInt(curPage.activeAsset) + 1].editing = false;
            }
            // Handle action when clicking on page, but not on asset
            if (curPage.data.click && event.button == 0) {
                switchPage(curPage.data.click);
            }
            curPage.activeAsset = null;
            canvas.context.beginPath(); // Clear active region
            showSubSection('pagina');
        }
    });

    $('#canvas').on('mouseup', function() {
        // When 'moving asset', stop on release of mouse button
        if (moving) {
            moving = false;
            this.style.cursor = 'default';
        }
    });

    $('#canvas').on('mousemove', function(event) {
        event.preventDefault();

        // Get mouse position and display appropriate cursor
        const mouseX = Math.floor(event.clientX - canvas.left);
        const mouseY = Math.floor(event.clientY - canvas.top);
        if (canvas.context.isPointInPath(mouseX, mouseY)) {
            this.style.cursor = 'grab';
        } else {
            this.style.cursor = 'default';
        }

        // When in 'asset moving' mode, process the actual move
        if (moving) {
            let newX = Number(curPage.data.asset[curPage.activeAsset].xpos) + (mouseX - refX);
            let newY = Number(curPage.data.asset[curPage.activeAsset].ypos) - (mouseY - refY);
            curPage.data.asset[curPage.activeAsset].xpos = newX;
            curPage.data.asset[curPage.activeAsset].ypos = newY;
            curPage.updated = true;
            $('#xpos').val(newX);
            $('#ypos').val(newY);
            $('#xSlider').slider('value', Math.floor(newX / currentStatus.canvasWidth * 1000));
            $('#ySlider').slider('value', Math.floor(newY / currentStatus.canvasHeight * 1000));    
            for (let i = 1; i < curPage.layers.length; i++) {
                if(curPage.layers[i].name == curPage.activeAsset) {
                    curPage.layers[i].x = newX;
                    curPage.layers[i].y = newY;
                }
            }
            refX = mouseX;
            refY = mouseY;
        }
    });
    
    requestAnimationFrame(function() {
        drawAssets();
    });

    if($('#message').text() == 'Loading...') {
        popUpMessage();
    }
}

// Function to add a new page based on a template and with image/video selected
function addNewPagewWithTemplate(template, imageName) {
    switchToTab('viewer');
    createPage(template);
    console.log('template', template);
    if (template == 'full_foto.json' || template == 'full_video.json' || template == 'doorlezer.json' || template == 'Tokio_full_video.json' || template == 'Tokio_flex.json') {
        curPage.activeAsset = 0;
        curPage.data.asset[curPage.activeAsset].img = imageName;
        // Position the media such that it fills the screen and is centered
        if (template == 'Tokio_flex.json') {
            curPage.data.asset[curPage.activeAsset].xpos = 0;
            curPage.data.asset[curPage.activeAsset].ypos = 0;
            curPage.data.asset[curPage.activeAsset].scale = 1.0;
        } else {
            const scaleX = currentStatus.canvasWidth / currentStatus.media[imageName].width;
            const scaleY = currentStatus.canvasHeight / currentStatus.media[imageName].height;
            const scale = Math.max(scaleX, scaleY);
            const overflowX = currentStatus.media[imageName].width * scale - currentStatus.canvasWidth;
            const overflowY = currentStatus.media[imageName].height * scale - currentStatus.canvasHeight;
            if (overflowX > 0) {
                curPage.data.asset[curPage.activeAsset].xpos = -(overflowX / 2).toFixed(0);
            }
            if (overflowY > 0) {
                curPage.data.asset[curPage.activeAsset].ypos = -(overflowY / 2).toFixed(0);
            }
            curPage.data.asset[curPage.activeAsset].scale = scale.toFixed(2);
            if (scale > 1.0) {
                popUpMessage({
                    title: 'Waarschuwing',
                    text: `<h1>Opgelet: deze video moest opgeschaald worden met een factor ${scale}!</h1>`,
                    ok: true
                });
            }
        }
        curPage.updated = true;
        drawPage();
        refreshAsset(curPage.activeAsset);
    } else if (template == 'Tokio_full_foto.json') {
        curPage.data.background = imageName;
        curPage.updated = true;
        $('#backgroundSelector').attr('src', getMediaPath(imageName));
        $('#backgroundSelector').attr('title', imageName);
        drawPage();        
    }
    $('#popup').hide(100); // Hide popup AFTER the action was triggered
    const pageId = currentStatus.pageIds[curPage.index].replace(/_/g, ' ');
    const thumbnail = `${currentStatus.presentationFolder + currentStatus.projectName}/screenshots/${imageName.replace(/\.[^/.]+$/, "")}.png`;
    $(`#page_${curPage.index}`).html(`<img src="${encodeURIComponent(thumbnail) + '?t=' + new Date().getTime()}" height="80" draggable="false"><br /><div class="pageId">${pageId}</div>`);
}

// Display list of all media
function displayMedia() {
    let formString = '<div id="mediaLocal"></div>';
    formString += '<div class="mediaAssets addButton">';
    formString += '<input type="file" accept=".jpg, .png, .mp4" name="newMedia" style="display: none;" multiple />';
    formString += '<img src="/img/add-icon.png" id="newMediaButton" />';
    formString += '<div class="progress"><div class="progress-bar" role="progressbar"></div></div>';
    formString += '</div>';
    formString += '<div style="clear: left;"><h2>Otto-importmap</h2><div id="reloadOtto"><i class="fas fa-fw fa-sync"></i></div></div>'
    formString += '<div id="mediaExtern"></div>';
    $('#media').html(formString);
    $('#reloadOtto').off();
    $('#reloadOtto').on('click', function() {
        socket.emit('reloadOtto');
    });
    // TODO live, live2 and live3 can probably be made more generic (based upon length of LIVE_VIDEO_TAGS)
    $('#mediaLocal').html(`<div class="mediaAssets" id="imageDrag_live" draggable="true"><img src="../../${LIVE_VIDEO_IMAGES[0]}" draggable="false" data-value="${LIVE_VIDEO_TAGS[0]}" id="image_live"><br><div class="fileName">Live 1</div></div>`);
    $('#mediaLocal').append(`<div class="mediaAssets" id="imageDrag_live2" draggable="true"><img src="../../${LIVE_VIDEO_IMAGES[1]}" draggable="false" data-value="${LIVE_VIDEO_TAGS[1]}" id="image_live2"><br><div class="fileName">Live 2</div></div>`);
    $('#mediaLocal').append(`<div class="mediaAssets" id="imageDrag_live3" draggable="true"><img src="../../${LIVE_VIDEO_IMAGES[2]}" draggable="false" data-value="${LIVE_VIDEO_TAGS[2]}" id="image_live3"><br><div class="fileName">Live 3</div></div>`);
    $('#imageDrag_live').on('dragstart', function(event) {
        event.originalEvent.dataTransfer.setData('text', event.target.id);
    });
    $('#imageDrag_live2').on('dragstart', function(event) {
        event.originalEvent.dataTransfer.setData('text', event.target.id);
    });
    $('#imageDrag_live3').on('dragstart', function(event) {
        event.originalEvent.dataTransfer.setData('text', event.target.id);
    });
    let mediaId = 0;
    for (let imageName in currentStatus.media) {
        let image = '';
        const video = isVideo(imageName);
        const data = currentStatus.media[imageName];
        // In case of video, display the generated thumbnail, else display photo.
        if (video) {
            if (data.dropFolder) {
                image = encodeURIComponent(`/dropfolder/${data.name.replace(/\.[^/.]+$/, "")}.png`) + '?t=' + new Date().getTime(); // <-- Trick to make sure images are always refreshed
            } else {
                image = encodeURIComponent(`${currentStatus.presentationFolder + currentStatus.projectName}/screenshots/${imageName.replace(/\.[^/.]+$/, "")}.png`) + '?t=' + new Date().getTime(); // <-- Trick to make sure images are always refreshed
            }
        } else {
            image = encodeURIComponent(`${currentStatus.presentationFolder + currentStatus.projectName}/${imageName}`) + '?t=' + new Date().getTime(); // <-- Trick to make sure images are always refreshed
        }
        if (data.dropFolder) {
            $('#mediaExtern').append(`<div class="mediaAssets" id="imageDrag_${mediaId}" title="${data.name}" draggable="true"><img src="${image}" draggable="false" data-value="${data.name}" id="image_${mediaId}" class="thumbnail" /><br/><div class="fileName scroll"><span>${data.name}</span></div></div>`);
        } else {
            $('#mediaLocal').append(`<div class="mediaAssets" id="imageDrag_${mediaId}" title="${imageName}" draggable="true"><img src="${image}" draggable="false" data-value="${imageName}" id="image_${mediaId}" class="thumbnail" /><br/><div class="fileName scroll"><span>${imageName}</span></div></div>`);
        }
        if (data.used) {
            $(`#imageDrag_${mediaId}`).addClass('used');
        }
        // Cover case when no thumbnail is found
        $('.thumbnail').on('error', function() {
            // Replacing image source
            $(this).attr('src', '/img/placeholder-image.jpg');
        });
        $(`#imageDrag_${mediaId}`).on('dragstart', function(event) {
            $(this).children('.fileName').removeClass('scroll').addClass('static');
            event.originalEvent.dataTransfer.setData('text', event.originalEvent.target.id);
            event.originalEvent.dataTransfer.setData('externalSource', (data.dropFolder ? true : false));
        });
        $(`#imageDrag_${mediaId}`).on('dragend', function(event) {
            $(this).children('.fileName').removeClass('static').addClass('scroll');
        });
        $(`#imageDrag_${mediaId}`).on('contextmenu', function(event) {
            // Avoid standard context menu
            event.preventDefault();

            const dialogTop = $('#media').closest('.ui-dialog').offset().top;
            const dialogLeft = $('#media').closest('.ui-dialog').offset().left;

            // Compose the custom menu
            $('#mediaPopup').empty();
            if (curPage.activeAsset !== null) {
                $('#mediaPopup').append(`<li id="addToAsset">Voeg toe aan asset ${curPage.data.asset[curPage.activeAsset].id}</li>`);
                // Define callback function
                $('#addToAsset').off();
                $('#addToAsset').on('click', function() {
                    switchToTab('viewer');
                    curPage.data.asset[curPage.activeAsset].img = imageName;
                    curPage.updated = true;
                    $('#img').attr('src', getMediaPath(imageName));
                    $('#img').attr('title', imageName);
                    // Hide it AFTER the action was triggered
                    drawPage();
                    $('#mediaPopup').hide(100);
                });
                $('#mediaPopup').append('<li class="separator"></li>');
            }
            if (video) {
                // Create full video template and add video
                $("#mediaPopup").append('<li id="fullVideo">Full video</li>');
                $('#fullVideo').on('click', function() {
                    addNewPagewWithTemplate('Tokio_full_video.json', imageName);
                    $('#mediaPopup').hide(100); // Hide it AFTER the action was triggered
                    $('#tab-media').dialog('close'); // Close Media window
                });
                $('#mediaPopup').append('<li id="flexVideo">Flex video</li>');
                $('#flexVideo').on('click', function() {
                    addNewPagewWithTemplate('Tokio_flex.json', imageName);
                    $('#mediaPopup').hide(100); // Hide it AFTER the action was triggered
                });
                // // Create doorlezer video template and add video
                // $("#mediaPopup").append('<li id="doorlezerVideo">Doorlezer</li>');
                // $('#doorlezerVideo').on('click', function() {
                //     addNewPagewWithTemplate('doorlezer.json', imageName);
                //     $('#mediaPopup').hide(100); // Hide it AFTER the action was triggered
                //     $('#tab-media').dialog('close'); // Close Media window
                // });    
                $('#mediaPopup').append('<li class="separator"></li>');
            } else {
                // Create full photo template and add video
                $("#mediaPopup").append('<li id="fullPhoto">Full foto</li>');
                $('#fullPhoto').on('click', function() {
                    addNewPagewWithTemplate('Tokio_full_foto.json', imageName);
                    $('#mediaPopup').hide(100); // Hide it AFTER the action was triggered
                    $('#tab-media').dialog('close'); // Close Media window
                });
                $('#mediaPopup').append('<li id="flexPhoto">Flex foto</li>');
                $('#flexPhoto').on('click', function() {
                    addNewPagewWithTemplate('Tokio_flex.json', imageName);
                    $('#mediaPopup').hide(100); // Hide it AFTER the action was triggered
                });   
                $('#mediaPopup').append('<li class="separator"></li>');                
            }
            $('#mediaPopup').append('<li id="deleteMedia">Verwijder</li>');
            $('#deleteMedia').on('click', function() {
                socket.emit('deleteMedia', imageName);
                $('#mediaPopup').hide(100); // Hide it AFTER the action was triggered
            });

            // Show contextmenu
            $('#mediaPopup').finish().toggle(100).
            css({   // In the right position (the mouse)
                top: (Number(event.pageY) - dialogTop - $('.ui-dialog-titlebar').height()) + "px",
                left: (Number(event.pageX) - dialogLeft) + "px"
            });
        });
        mediaId++;
    }
    $('.progress').hide();
    $('#newMediaButton').on('click', function() {
        $('input[name="newMedia"]').trigger('click');
        $('.progress-bar').text('0%');
        $('.progress-bar').width('0%');
    });
    $('input[name="newMedia"]').on("change", function() {
        const files = $(this).get(0).files;
        if (files.length > 0) {
            // One or more files selected, process the file upload
            // create a FormData object which will be sent as the data payload in the
            // AJAX request
            let formData = new FormData();
            formData.append('userName', userName);
            formData.append('projectName', currentStatus.projectName);
            // Loop through all the selected files
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Add the files to formData object for the data payload
                formData.append('newMedia', file, file.name);                
            }
            // Make the AJAX request
            $.ajax({
                url: '/upload',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(data){
                    console.log('upload successful!\n');
                },
                xhr: function() {
                    // Create an XMLHttpRequest
                    const xhr = new XMLHttpRequest();
                    // Listen to the 'progress' event
                    xhr.upload.addEventListener('progress', function(evt) {
                        if (evt.lengthComputable) {
                            // Calculate the percentage of upload completed
                            let percentComplete = evt.loaded / evt.total;
                            percentComplete = parseInt(percentComplete * 100);
                            // Update the progress bar with the new percentage
                            $('.progress').show();
                            $('.progress-bar').text(percentComplete + '%');
                            $('.progress-bar').width(percentComplete + '%');
                            // Once the upload reaches 100%, set the progress bar text to done
                            if (percentComplete === 100) {
                                $('.progress-bar').html('Done');
                            }
                        }
                    }, false);
                    return xhr;
                }
            });
        }
    });
}

// Display list of all templates
function displayTemplates() {
    $('#templates').empty();
    $('#templates').append(`<div class="mediaAssets" id="templateDrag_x" draggable="true"><img src="/img/empty_page.png" draggable="false" data-value="" id="template_x" /><br/><div class="fileName">Lege pagina</div></div>`);
    $('#templateDrag_x').on('contextmenu', function(event) {
        // Avoid standard context menu
        event.preventDefault();

        // Compose the custom menu
        $('#popup').html('<li id="new">Nieuwe pagina</li>');
        $('#popup').append('<li id="current">Huidige pagina</li>');

        // Show contextmenu
        $('#popup').finish().toggle(100).

        // In the right position (the mouse)
        css({
            top: (Number(event.pageY) - $('#menu-bar').height()) + "px",
            left: (Number(event.pageX) - $('#sidebar-left').width()) + "px"
        });

        // Define callback function for applying template to a new page
        $('#new').on('click', function() {
            $('#popup').hide(100); // Hide dropdown menu
            createPage();
        });

        // Define callback function for applying template to current page
        $('#current').on('click', function() {
            $('#popup').hide(100); // Hide dropdown menu
            curPage.updated = true;
            curPage.data.unSaved = true;
            curPage.template.setTemplate();
            $(`#template option[value='']`).attr('selected', 'selected');
            switchToTab('viewer');
        });
    });
    for (let i in currentStatus.templates) {
        let image = '';
        let templateName = currentStatus.templates[i].template;
        const templateNameClean = templateName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').replace(/\.[^/.]+$/, "");
        if (currentStatus.templates[i].template.split('.').pop() != "html" && 
            currentStatus.templates[i].template.split('.').pop() != "json") {
            image = '/img/placeholder.png';
        } else {
            image = encodeURIComponent(currentStatus.templates[i].filePath + currentStatus.templates[i].template.substr(0, currentStatus.templates[i].template.lastIndexOf('.')) + '.png');
        }
        $('#templates').append(`<div class="mediaAssets" id="templateDrag_${i}" draggable="true"><img src="${image}" draggable="false" data-value="${templateName}" id="template_${i}" /><br/><div class="fileName">${templateNameClean}</div></div>`);
        $('#templateDrag_' + i).on('contextmenu', function(event) {
            // Avoid standard context menu
            event.preventDefault();

            // Compose the custom menu
            $('#popup').html('<li id="new">Nieuwe pagina</li>');
            $('#popup').append('<li id="current">Huidige pagina</li>');

            // Show contextmenu
            $('#popup').finish().toggle(100).

            // In the right position (the mouse)
            css({
                top: (Number(event.pageY) - $('#menu-bar').height()) + "px",
                left: (Number(event.pageX) - $('#sidebar-left').width()) + "px"
            });

            // Define callback function for applying template to a new page
            $('#new').on('click', function() {
                $('#popup').hide(100); // Hide dropdown menu
                createPage(templateName);
            });

            // Define callback function for applying template to current page
            $('#current').on('click', function() {
                $('#popup').hide(100); // Hide dropdown menu
                curPage.data.template = templateName;
                curPage.updated = true;
                curPage.data.unSaved = true;
                curPage.template.setTemplate(templateName);
                $(`#template option[value='${templateName}']`).attr('selected', 'selected');
                switchToTab('viewer');
            });
        });
    }
    $('#templates').append('<div id="importTemplates" title="Import nieuwe templates (beta)."><i class="fas fa-3x fa-file-import"></i></div>');
    $('#importTemplates').on('click', () => {
        socket.emit('importTemplates');
    });     
}

// Switch page (no server fetch)
// When trigger is true, this sends out a trigger to all browsers of this user
function switchPage(page, trigger=true) {
    // Replace placeholders
    let pageId = -1;
    if (page == '[NEXT]') {
        if (curPage.index + 1 < currentStatus.pageIds.length) {
            pageId = curPage.index + 1;
        } else {
            // Return to root page
            pageId = 0;
        }
    } else if (page == '[PREV]') {
        if (curPage.index > 0) {
            pageId = curPage.index - 1;
        } else {
            return false;
        }
    } else if (page == '[UNDO]') {
        let lastAction = history.getLastAction();
        if (!lastAction.hasOwnProperty('asset')) {
            if (lastAction.id > -1) {
                pageId = lastAction.id;
            } else {
                return false;
            }
        } else {
            curPage.layers[lastAction.asset + 1].jumpTo(lastAction.keyframe);
            return false;
        }
    } else if (page == '[ROOT]') {
        pageId = 0;
    } else {
        pageId = currentStatus.pageIds.indexOf(page);
        if (pageId == -1) {
            return false;
        }
    }

    // Update history
    history.addPageToHistory(pageId);

    // Clear canvas
    $('#videoControl').hide();
    curPage.activeAsset = null;    // Disable active asset highlight

    // Make sure unsaved changes get saved
    if (curPage.updated) {
        curPage.save();
        if (curPage.index == pageId) {
            drawPage();
            return false;
        }
    }

    // Update the specified page
    curPage.index = pageId;
    // Send out pageId
    if (trigger) {
        socket.emit('triggerPage', pageId);
    }
    // Set active page in Page Sequence
    $('#page_' + pageId).parents('#pages').find('.active').removeClass('active').end().end().addClass('active');
    // Prepare template
    curPage.template = new Template();

    // Bring the iframe upfront when no assets are detected
    if (curPage.data.asset) {
        $('iframe').css('z-index', -10);
    } else {
        $('iframe').css('z-index', 0);
    }

    // Completely draw the page
    drawPage();
    drawNavigationAids();
    // Show page information in sidebar
    $('#assetInfo').hide();
    showPageInfo();
    return true;
}

// Enable the iframe page to access the switchPage function
window.switchPage = switchPage;
window.toggleRightBar = toggleRightBar;

// Create a new page
function createPage(templateName) {
    // First make sure unsaved changes get saved
    if (curPage.updated) {
        curPage.save();
    }
    // Attaching the page to the end of the page list,
    // so the index is equal to the length of the list.
    const newIndex = currentStatus.pageIds.length;
    // Make sure the pageName is not yet in use, otherwise keep incrementing.
    let pageName = newIndex;
    while (currentStatus.pageIds.indexOf(pageName.toString()) != -1) {
        pageName++;
    }
    // Create an empty page
    let page = {
        id: pageName.toString(),
        unSaved: true
    }
    if (templateName) {
        page.template = templateName;
    }
    // Add page to the currentStatus memory
    currentStatus.data.push(page);
    currentStatus.pageIds.push(page.id);
    // get page cache updated
    curPage.index = newIndex;
    // Clear the template
    curPage.template = new Template();
    if (templateName) {
        curPage.template.setTemplate(templateName);
    }
    curPage.updated = true;
    // Draw the page as is
    drawPage();
    switchToTab('viewer');
    // Show page information   
    $('#assetInfo').hide();
    showPageInfo();
    toggleRightBar(true);
    // Show Pages Bar
    displayPagesBar();
    curPage.makeSnapShot();
}

// Delete page
function deletePage(pageIndex) {
    // First make sure unsaved changes get saved
    if (curPage.updated) {
        curPage.save();
    }
    currentStatus.pageIds.splice(pageIndex, 1);
    currentStatus.data.splice(pageIndex, 1);
    socket.emit('deletePage', pageIndex);
    // Check for case where current page is updated and being deleted
    // avoiding the trigger that makes saves the page first
    if (pageIndex == curPage.index && curPage.updated) {
        curPage.updated = false;
    }
    if (pageIndex < curPage.index) {
        curPage.index--;
    } else if (pageIndex == curPage.index) {
        if (pageIndex >= currentStatus.pageIds.length) {
            curPage.index--;
        }
        // Check if all pages were deleted
        if (curPage.index < 0) {
            curPage.reset();
        } else {
            switchPage(currentStatus.pageIds[curPage.index]);
        }
    }
    displayPagesBar();
}

// Add dropdown menu to select a page
function createPageSelector(selectorName, target) {
    const selector = $(`#${selectorName}Selector`);
    selector.html('<option value="[NONE]">Geen</option>');
    selector.append('<option disabled>Shortcuts</option>');
    selector.append('<option value="[ROOT]">Startpagina</option>');
    selector.append('<option value="[PREV]">Vorige pagina</option>');
    selector.append('<option value="[NEXT]">Volgende pagina</option>');
    selector.append('<option value="[UNDO]">Stap terug</option>');
    selector.append('<option disabled>Pagina\'s</option>');
    if (currentStatus.pageIds.length > 0) {
        for (let pageIndex in currentStatus.pageIds) {
            if (pageIndex != curPage.index) {
                selector.append(`<option value="${pageIndex}">${currentStatus.pageIds[pageIndex].replace(/_/g, ' ')}</option>`);
            } else {
                selector.append(`<option value="${pageIndex}" class="current">${currentStatus.pageIds[pageIndex].replace(/_/g, ' ')}</option>`);
            }
        }
        selector.prop('disabled', false);
    } else {
        selector.prop('disabled', true);
    }
    if (target[selectorName] == undefined || target[selectorName] == -1) {
        selector.val('[NONE]');
    } else if (target[selectorName].type) {
        if (!target[selectorName].url) {
            selector.val('[NONE]');            
        } else if (currentStatus.pageIds.indexOf(target[selectorName].url) == -1) {
            selector.val(target[selectorName].url);
        } else {
            selector.val(currentStatus.pageIds.indexOf(target[selectorName].url));
        }
    } else if (currentStatus.pageIds.indexOf(target[selectorName]) == -1) {
        selector.val(target[selectorName]);
    } else {
        selector.val(currentStatus.pageIds.indexOf(target[selectorName]));
    }
    selector.off();
    selector.addClass('activeEvent');
    selector.on('change', function() {
        let selectedIndex = $(this).val();
        if (!target[selectorName]) {
            target[selectorName] = '';
        }
        if (selectedIndex == '[NONE]') {
            if (target[selectorName].type) {
                delete target[selectorName].url;
            } else {
                delete target[selectorName];
            }
        } else if (isNaN(selectedIndex)) {
            if (target[selectorName].type) {
                target[selectorName].url = selectedIndex;
            } else {
                target[selectorName] = selectedIndex;
            }
        } else {
            if (target[selectorName].type) {
                target[selectorName].url = currentStatus.pageIds[selectedIndex];
            } else {
                target[selectorName] = currentStatus.pageIds[selectedIndex];
            }
        }
        curPage.updated = true;
        drawNavigationAids();
    });
}

// Add button to select an image or video
function createImageSelector(selectorName, target, templateTarget = null) {
    const selector = $(`#${selectorName}Selector`);
    // Set button properties
    selector.attr('draggable', false);
    selector.addClass('imageThumbnail');
    // Populate all fields with current values, if available
    if (target[selectorName]) {
        if (target[selectorName].type) {
            selector.attr('src', getMediaPath(target[selectorName].content));
            selector.attr('title', target[selectorName].content);           
        } else {
            if (LIVE_VIDEO_TAGS.includes(target[selectorName])) {
                selector.attr('src', LIVE_VIDEO_IMAGES[LIVE_VIDEO_TAGS.indexOf(target[selectorName])]);
            } else {
                selector.attr('src', getMediaPath(target[selectorName]));
            }
            selector.attr('title', target[selectorName]);
        }
    } else {
        selector.attr('src', '/img/placeholder-image.jpg');
        selector.attr('title', 'Placeholder');
    }
    // Clear all listeners
    selector.off();
    // Open media tab after click
    selector.addClass('activeEvent');
    selector.on('click', function() {
        switchToTab('media');
    });
    // Right-click to clear field
    selector.on('contextmenu', function(event) {
        event.preventDefault();
        // Compose the custom menu
        $('#popup').html('<li id="delete">Verwijder</li>');
        // Show contextmenu, to the right of the mouse location
        $('#popup').finish().toggle(100).
        css({
            top: (Number(event.pageY) - $('#menu-bar').height()) + "px",
            left: (Number(event.pageX) - $('#sidebar-left').width()) + "px"
        });
        // Clear image
        $('#delete').on('click', function() {
            $('#popup').hide(100); // Hide dropdown menu
            if (target[selectorName].type) {
                target[selectorName].content = '';
                if (templateTarget) templateTarget[selectorName].content = '';
            } else {
                target[selectorName] = '';
                if (templateTarget) templateTarget[selectorName] = '';
            }
            console.log('delete', curPage.data);
            curPage.updated = true;
            selector.attr('src', '/img/placeholder-image.jpg');
            $('#keyframesContainer').hide();
            $('#loopContainer').hide();
            drawPage();
        });
    });    
    // Disable drag over actions
    selector.on('dragover', function(event) {
        event.preventDefault();
    });
    // Process dropping image on button
    selector.on('drop', function(event) {
        event.stopPropagation();
        switchToTab('viewer');
        const data = "image_" + event.originalEvent.dataTransfer.getData('text').split('_')[1];
        const externalSource = (event.originalEvent.dataTransfer.getData('externalSource') == 'true' ? true : false);
        const imageName = document.getElementById(data).dataset.value;
        if (target[selectorName] && target[selectorName].type) {
            target[selectorName].content = imageName;
            if (templateTarget) templateTarget[selectorName].content = imageName; // TODO Can we incorporate this into something like setField()?
        } else {
            target[selectorName] = imageName;
            if (templateTarget) templateTarget[selectorName] = imageName;
        }
        curPage.updated = true;
        if (externalSource) {
            $(this).attr('src', `/dropfolder/${imageName.replace(/\.[^/.]+$/, "")}.png`);
            socket.emit('consolidateMedia', imageName);
            popUpMessage({
                title: 'Importeren',
                text: `<h3>Media ${imageName.replace(/\.[^/.]+$/, "")} importeren.</h3>`,
                modal: true,
                ok: false
            });
        } else {
            if (LIVE_VIDEO_TAGS.includes(imageName)) {
                $(this).attr('src', LIVE_VIDEO_IMAGES[LIVE_VIDEO_TAGS.indexOf(imageName)]);
            } else {
                $(this).attr('src', getMediaPath(imageName));
            }
        }
        $(this).attr('title', imageName);
        if (isVideo(imageName) && !target[selectorName].type) {
            $('#keyframesContainer').show();
            $('#loopContainer').show();
        } else {
            $('#keyframesContainer').hide();
            $('#loopContainer').hide();
        }
        drawPage();
    });
    // When thumbnail image is not found use placeholder
    selector.on('error', function() {
        $(this).attr('src', '/img/placeholder-image.jpg');
    });
}

// Display page information in sidebar
function showPageInfo() {
    createImageSelector('background', curPage.data);
    // Fill out Page Information
    $('#id').val(curPage.data.id.toString().replace(/_/g, ' '));
    if(curPage.data.html && curPage.data.html.startsWith('http')) {
        $('#html').val(curPage.data.html);
    } else {
        $('#html').val('');
    }

    // Create annotate selector
    $('#annotate').html('<option value="[NONE]">Geen</option>');
    $('#annotate').append('<option value="[GREEN]">Groen</option>');
    $('#annotate').append('<option value="[RED]">Rood</option>');
    if (curPage.data.annotate) {
        $('#annotate').val(curPage.data.annotate);
        $('#annotate').attr('class', curPage.data.annotate.replace(/[\[\]']+/g,''));
    } else {
        $('#annotate').attr('class', 'NONE');
    }

    $('#template').html('<option value="">Geen</option>');
    if (currentStatus.templates.length > 0) {
        for (let templateId in currentStatus.templates) {
            let fileName = currentStatus.templates[templateId].template;
            let fileNameClean = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').replace(/\.[^/.]+$/, "");
            if (fileName == curPage.data.template) {
                $('#template').append(`<option value="${fileName}" selected="selected">${fileNameClean}</option>`);
            } else {
                $('#template').append(`<option value="${fileName}">${fileNameClean}</option>`);
            }
        }
    } 

    // Set all field input fields for selected template
    curPage.template.setFieldsInput();
   
    // Set all navigational dropdown selectors
    createPageSelector('back', curPage.data);
    createPageSelector('next', curPage.data);
    createPageSelector('up', curPage.data);
    createPageSelector('down', curPage.data);
    createPageSelector('click', curPage.data);

    // Repopulate Asset list
    $('#assets').html('<option disabled selected value>Selecteer asset</option>');
    for (let assetId in curPage.data.asset) {
        let assetContent = curPage.data.asset[assetId];
        let assetName = (assetContent.id ? assetContent.id : assetId);
        // Add asset to select
        $('#assets').append(`<option value="${assetId}">${assetName}</option>`);
    }
    $('#assets').append('<option value="new">[Voeg asset toe]</option>'); 

    // Clear all listeners
    $('#id').off();
    $('#html').off();
    $('#annotate').off();
    $('#template').off();
    $('#assets').off();

    // Activate all listeners
    $('#id').on('change keyup focusout', function(event) {
        let newId = $(this).val().replace(/ /g, '_');
        // When user acknowledges the change, do a check for existing names
        if (event.type == 'change' || event.type == 'focusout') {
            if (currentStatus.pageIds.indexOf(newId) == -1 || newId == curPage.data.id) {
                curPage.data.id = newId;
                curPage.updated = true;
            } else {
                // Warn the user that name is already in use
                $(this).val(curPage.data.id);
                popUpMessage({
                    title: 'Probleem',
                    text: '<h3>Naam reeds in gebruik</h3><p>Voer een andere naam in.</p>',
                    modal: true,
                    ok: true 
                });
            }
        } else {
            // Update the fields after each keyup
            curPage.updated = true;
            $(`#page_${curPage.index}`).children('.pageId').html($(this).val());
        }
    });
    $('#html').on('change', function() {
        const newHtml = $(this).val();
        curPage.data.html = newHtml;
        curPage.updated = true;
        curPage.template.setHtml(newHtml);
        switchToTab('viewer');
    });
    $('#annotate').on('change', function() {
        const value = $(this).val();
        curPage.data.annotate = value;
        $('#annotate').attr('class', value.replace(/[\[\]']+/g,''));
        curPage.updated = true;        
    });
    $('#template').on('change', function() {
        curPage.data.template = $(this).val();
        curPage.updated = true;
        curPage.data.unSaved = true;
        curPage.template.setTemplate($(this).val());
    });
    $('#assets').on('change', function() {
        let assetId = $(this).val();
        if(assetId == 'new') {

            // When no assets are present, add a first one
            let newAssetId = 0;
            if (curPage.data.asset == undefined) {
                curPage.data.asset = [];
            } else {
                newAssetId = curPage.data.asset.length;
            }
            
            // Add default asset information 
            curPage.data.asset[newAssetId] = {
                id: newAssetId,
                img: "",
                xpos: 0,
                ypos: 0,
                scale: 1,
                url: -1
            };
            curPage.updated = true;

            assetId = newAssetId;
            curPage.activeAsset = assetId;
            // TODO: here a refreshAsset does not work when the background is a movie... strange...
            drawPage();
            showAssetInfo(assetId, curPage.data.asset[assetId]);
        } else {
            refreshAsset(assetId);
        }
    });
}


// Display videoControl
function displayVideoControl(keyframes) {
    // $('#videoControl').dialog();
    // TO DO: http://jsfiddle.net/arunpjohny/aLLAw/

    // Make sure that this function is called while a video layer is active
    const videoAsset = curPage.layers[parseInt(curPage.activeAsset) + 1];
    if (videoAsset.type != 'video') {
        return;
    }

    // Process the keyframes
    let keyFramesArray = [];
    try {
        if (keyframes != '') {
            keyFramesArray = keyframes.split(',').map(parseFloat);
        } else {
            keyFramesArray = [];
        }
    } catch {
        keyFramesArray = [];
    }

    // Prepare the basic keyframes of the video
    const videoSlider = document.getElementById('videoSlider');
    const videoLength = parseFloat(videoAsset.getDuration().toFixed(2));
    let startValue = 0;
    let endValue = videoLength;
    let currentValue = videoLength/2;

    // Create a pips list by combining, eliminating duplicates and sorting 
    let pips = [...new Set([...[0, videoLength],...keyFramesArray])].sort(function(a, b){return a - b});

    // Update the keyframes in the database (TODO: remove from video controller and place in correct class)
    $('#keyframes').val(keyFramesArray.join());
    curPage.data.asset[curPage.activeAsset].keyframes = keyFramesArray.join();

    // Remove first pip if video does not start at zero
    if (pips[0] != keyFramesArray[0]) {
        pips.shift();
    }

    // Remove last pip if video does not end on last frame
    if (pips[pips.length-1] != keyFramesArray[keyFramesArray.length-1]) {
        pips.pop();
    }

    // Setup video slider
    videoSlider.noUiSlider.updateOptions({
        range: {        
            'min': [startValue],
            '50%': [currentValue],
            'max': [endValue]
        },
		pips: {
			mode: 'values',
			values: pips,
			density: 2,
			stepped: true,
			format: wNumb({
				decimals: 2
			})
		}
    });

    // Add names to pips and make them clickable
    $('.noUi-pips').children('.noUi-value').each(function(id) {
        // Give each pip a seperate ID
        $(this).attr('id', `pip_${id}`);
        // Add listener to pip
        $(`#pip_${id}`).off();
        $(`#pip_${id}`).on('click', () => {
            const keyFrame = id;
            const videoAsset = curPage.layers[parseInt(curPage.activeAsset) + 1];
            videoAsset.pause();
            if (keyFrame == 0) {
                videoSlider.noUiSlider.set([keyFramesArray[keyFrame], keyFramesArray[keyFrame], null]);
            } else if (keyFrame == keyFramesArray.length - 1) {
                videoSlider.noUiSlider.set([null, keyFramesArray[keyFrame], keyFramesArray[keyFrame]]);
            } else {
                videoSlider.noUiSlider.set([null, keyFramesArray[keyFrame], null]);
            }
            videoAsset.jumpTo(keyFramesArray[keyFrame]);
        });
    });

    // Reset begin and end values to the updated keyframes
    if (keyFramesArray[0]) {
        startValue = parseFloat(keyFramesArray[0], 2);
    }
    if (keyFramesArray.length > 1) {
        endValue = parseFloat(keyFramesArray.slice(-1));
    }
    currentValue = parseFloat(videoAsset.getCurrentTime());

    // Update the slider with the correct values
    videoSlider.noUiSlider.set([startValue, currentValue, endValue]);
    videoSlider.noUiSlider.off();
    videoSlider.noUiSlider.on('start', (values, handle) => {
        const asset = curPage.layers[parseInt(curPage.activeAsset) + 1];
        // Update the video time
        asset.jumpTo(values[handle]);
    });

    // Activate slide scrubbing and (de)activate insert keyframe button
    videoSlider.noUiSlider.on('slide', (values, handle) => {
        const asset = curPage.layers[parseInt(curPage.activeAsset) + 1];
        // Update the video time
        asset.jumpTo(values[handle]);
        $('#addKeyFrameButton').removeClass('fa-minus');
        $('#addKeyFrameButton').addClass('fa-plus');
    });

    // Set start/end keyframes 
    videoSlider.noUiSlider.on('end', (values, handle) => {
        if (handle == 0) {
            curPage.layers[parseInt(curPage.activeAsset) + 1].setStartPoint(values[handle]);
        } else if (handle == 2) {
            curPage.layers[parseInt(curPage.activeAsset) + 1].setEndPoint(values[handle]);
        }
    });

    // Pause the video when clicked on any handle
    $('.noUi-base').on('mousedown', () => {
        curPage.layers[parseInt(curPage.activeAsset) + 1].pause();
    });

    // Define action to insert a keyframe
    $(`#keyframe_insert`).off()
    $(`#keyframe_insert`).on('click', function() {
        const keyFramesString = $('#keyframes').val();
        const newKeyFramesString = curPage.layers[parseInt(curPage.activeAsset) + 1].updateKeyFrames(keyFramesString, curPage.layers[parseInt(curPage.activeAsset) + 1].getCurrentTime());
        displayVideoControl(newKeyFramesString);
        curPage.layers[parseInt(curPage.activeAsset) + 1].keyFrames.highlight(curPage.layers[parseInt(curPage.activeAsset) + 1].getCurrentTime());
    });

    // Define play action
    $(`#video_play`).off();
    $(`#video_play`).on('click', function() {
        curPage.layers[parseInt(curPage.activeAsset) + 1].play();
    });

    // Define jumping to next keyframe
    $(`#video_next`).off();
    $(`#video_next`).on('click', function() {
        curPage.layers[parseInt(curPage.activeAsset) + 1].jumpForwards();
        videoSlider.noUiSlider.set([null, curPage.layers[parseInt(curPage.activeAsset) + 1].getCurrentTime(), null]);
    });

    // Define jumping to previous keyframe
    $(`#video_previous`).off();
    $(`#video_previous`).on('click', function() {
        curPage.layers[parseInt(curPage.activeAsset) + 1].jumpBackwards();
        videoSlider.noUiSlider.set([null, curPage.layers[parseInt(curPage.activeAsset) + 1].getCurrentTime(), null]);
    });

    // Define scrub forwards
    $(`#video_fastforward`).off();
    $(`#video_fastforward`).on('click', function() {
        curPage.layers[parseInt(curPage.activeAsset) + 1].stepForward();
        videoSlider.noUiSlider.set([null, curPage.layers[parseInt(curPage.activeAsset) + 1].getCurrentTime(), null]);
    });

    // Define scrub backwards
    $(`#video_fastbackward`).off();
    $(`#video_fastbackward`).on('click', function() {
        curPage.layers[parseInt(curPage.activeAsset) + 1].stepBackward();
        videoSlider.noUiSlider.set([null, curPage.layers[parseInt(curPage.activeAsset) + 1].getCurrentTime(), null]);
    });

    // Delete all keyframes and reset in/out
    $(`#deleteAllKeyFrames`).off();
    $('#deleteAllKeyFrames').on('click', function() {
        const newKeyFrames = `0.0,${curPage.layers[parseInt(curPage.activeAsset) + 1].getDuration().toFixed(2)}`;  // TODO can be cleaner
        $('#keyframes').val(newKeyFrames);
        $('#keyframes').trigger('change');
    });
}

// Get the media path of an image or video
function getMediaPath(assetName) {
    let imagePath = '';
    if (assetName) {
        if (isVideo(assetName)) {
            imagePath = encodeURIComponent(`${currentStatus.presentationFolder + currentStatus.projectName}/screenshots/${assetName.replace(/\.[^/.]+$/, "")}.png`) + '?t=' + new Date().getTime();
        } else {
            imagePath = currentStatus.presentationFolder + currentStatus.projectName + '/' + assetName;
        }
    }
    return imagePath;
}

// Display asset information in sidebar
function showAssetInfo(assetId, asset) {
    // Repopulate URL select dropdown
    createPageSelector('url', curPage.data.asset[assetId]);
    createImageSelector('img', curPage.data.asset[assetId]);

    // Repopulate Transition select dropdown
    $('#transition').empty();
    for (let key in TRANSITIONS) {
        if (TRANSITIONS.hasOwnProperty(key)) {
            $('#transition').append('<option value="' + key + '">' + TRANSITIONS[key] + '</option>');
        }
    }
    $('#transition').prop('disabled', false);

    // Populate all fields with current values, if available
    if (asset) {
        $('#assetId').val(asset.id ? asset.id : assetId);
        $('#xpos').val(asset.xpos);
        $('#xSlider').slider('value', Math.floor(asset.xpos / currentStatus.canvasWidth * 1000));
        $('#ypos').val(asset.ypos);
        $('#ySlider').slider('value', Math.floor(asset.ypos / currentStatus.canvasHeight * 1000));
        $('#scale').val(asset.scale ? asset.scale * 100 : 100);
        $('#scaleSlider').slider('value', asset.scale ? asset.scale * 100 : 100);
        $('#zoom').prop('checked', asset.zoom ? true : false);        
        $('#transition').val(asset.transition ? asset.transition : 'none');
        $('#keyframes').val(asset.keyframes ? asset.keyframes : '');
        $('#loop').prop('checked', asset.loop == 'once' ? false : true);
        if (isVideo(asset.img)) {
            $('#keyframesContainer').show();
            $('#loopContainer').show();
            displayVideoControl(asset.keyframes);
        } else {
            $('#keyframesContainer').hide();
            $('#loopContainer').hide();
        }
    } else {
        $('#assetId').val(assetId);
        $('#xpos').val(0);
        $('#xSlider').slider('value', 0);
        $('#ypos').val(0);
        $('#ySlider').slider('value', 0);
        $('#scale').val(100);
        $('#scaleSlider').slider('value', 100);
        $('#zoom').prop('checked', false);
        $('#transition').val('none');
        $('#keyframes').val('');
        $('#loop').prop('checked', false);
    }

    // Clear all listeners
    $('#deleteAsset').off();
    $('#assetId').off();
    $('#xpos').off();
    $('#ypos').off();
    $('#scale').off();
    $('#zoom').off();
    $('#transition').off();
    $('#keyframes').off();
    $('#loop').off();

    // Activate all listeners
    $('#deleteAsset').on('click', function() {
        curPage.removeAsset(assetId);
        $('#assetInfo').hide();
        drawPage();
        showPageInfo();     
    });   
    $('#assetId').on('change', function(event) {
        const newId = $(this).val();
        curPage.data.asset[assetId].id = newId;
        curPage.updated = true;
    });
    $('#xpos').on('change keyup', function() {
        const newXpos = $(this).val();
        curPage.data.asset[assetId].xpos = newXpos;
        curPage.updated = true;
        $('#xSlider').slider('value', Math.floor(newXpos / currentStatus.canvasWidth * 1000));
        refreshAsset(assetId);
    });
    $('#ypos').on('change keyup', function() {
        const newYpos = $(this).val();
        curPage.data.asset[assetId].ypos = newYpos;
        curPage.updated = true;
        $('#ySlider').slider('value', Math.floor(newYpos / currentStatus.canvasHeight * 1000));
        refreshAsset(assetId);
    });
    $('#scale').on('change keyup', function() {
        const newScale = $(this).val();
        curPage.data.asset[assetId].scale = newScale / 100;
        curPage.updated = true;
        refreshAsset(assetId);
    });
    $('#zoom').on('change', function() {
        const state = $(this).is(':checked');
        curPage.data.asset[assetId].zoom = (state ? 'true' : '');
        curPage.updated = true;        
    });
    $('#transition').on('change', function() {
        const newTransition = $(this).val();
        curPage.data.asset[assetId].transition = newTransition;
        curPage.updated = true;
    });
    $('#keyframes').on('change', function() {
        const newKeyFrames = curPage.layers[parseInt(curPage.activeAsset) + 1].updateKeyFrames($(this).val());
        $(this).val(newKeyFrames);
        curPage.data.asset[assetId].keyframes = newKeyFrames;
        curPage.updated = true;
        displayVideoControl(newKeyFrames);
    });
    $('#loop').on('change', function() {
        const state = $(this).is(':checked');
        curPage.data.asset[assetId].loop = (state ? '' : 'once');
        curPage.updated = true;        
    });

    // Show sidebar
    $('#assetInfo').show();
    showSubSection('asset');
}

class Photo {
    constructor(source, x, y, scale, name) {
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.name = name;

        this.xScaled = null;
        this.yScaled = null;
        this.widthScaled = null;
        this.heightScaled = null;

        this.image = new Image();
        this.isLoaded = false;
        let self = this;
        this.image.onload = function() {
            self.isLoaded = true;
        }
        this.image.src = source;

        this.type = "photo";
        this.clickable = true;
        this.fit = false;
    }
    draw() {
  	    if (this.isLoaded) {
            if (this.fit) {
                canvas.context.drawImage(this.image, 0, 0, canvas.width, canvas.height);
            } else {
                canvas.context.drawImage(this.image, this.xScaled, this.yScaled, this.widthScaled, this.heightScaled);
            }
            if (this.name == curPage.activeAsset) {
                if (defineShape(this.shape)) {
                    canvas.context.strokeStyle = "#FF00FF";
                    canvas.context.stroke();
                } 
            }
        }
    }
    update() {
        if (this.isLoaded) {
            this.xScaled = Math.floor(this.x * canvas.scale);
            this.yScaled = Math.floor((currentStatus.canvasHeight - this.y - this.image.height * this.scale) * canvas.scale);
            this.widthScaled = Math.floor(this.image.width * canvas.scale * this.scale);
            this.heightScaled = Math.floor(this.image.height * canvas.scale * this.scale);
            if (this.clickable) {
                this.shape = {
                    name: this.name,
                    points: [
                        { x: this.xScaled, y: this.yScaled },
                        { x: (this.xScaled + this.widthScaled), y: this.yScaled },
                        { x: (this.xScaled + this.widthScaled), y: (this.yScaled + this.heightScaled) },
                        { x: this.xScaled, y: (this.yScaled + this.heightScaled) }
                    ]
                }
                shapes[this.name] = this.shape;
            }
            this.draw();
        }
    } 
}

class Video {
    constructor(source, x, y, scale, name = null) {
        this.source = source;
        this.x = x;
        this.y = y;
        this.scale = scale;
        this._name = name;

        this._loop = false;
        this.playingBackwards = false;

        this._keyFrames = new Keyframes(this);
        this.nextKeyFrame = -1;
        this._currentTime = 0;

        this.xScaled = null;
        this.yScaled = null;
        this.widthScaled = null;
        this.heightScaled = null;

        this.type = "video";
        this.clickable = true;

        this._editMode = false;
    }
    // Setters and getters
    set name(value) {
        this._name = value;
    }
    get name() {
        return this._name;
    }
    set loop(value) {
        this._loop = value;
        this.source.loop = value;
    }
    get loop() {
        return this._loop;
    }
    set keyFrames(value) {
        this._keyFrames = value;
    }
    get keyFrames() {
        return this._keyFrames;
    }
    set currentTime(value) {
        this._currentTime = value;
    }
    get currentTime() {
        return this._currentTime;
    }
    set editing(value) {        
        this._editMode = value;
        console.log('editing ', value);
        $('#videoControl').toggle(value);
    }
    get editing() {
        return this._editMode;
    }
    // Set the keyframes, converting them from a string
    setKeyFrames(keyFramesString) {
        let keyFramesArray = [];
        if (keyFramesString != '') {
            keyFramesArray = keyFramesString.split(',').map(parseFloat);
        }
        if (keyFramesArray.length == 0) {
            keyFramesArray = [0, this.getDuration()];
            if (curPage.activeAsset) {
                $('#keyframes').val(keyFramesArray.join());
                curPage.data.asset[curPage.activeAsset].keyframes = keyFramesArray.join();
            }
        } else if (keyFramesArray.length == 1) {
            keyFramesArray = [0, keyFramesArray[0], this.getDuration()];
        }
        this.keyFrames.keyframes = keyFramesArray;
    }
    play() {
        if (this.source.paused) {
            this.keyFrames.highlight();   // Remove active state of keyFrame buttons
            const keyFrame = this.keyFrames.next();
            if (keyFrame < 0) {
                this.jumpTo(this.keyFrames.first());
                this.nextKeyFrame = this.keyFrames.next();
            } else {
                this.nextKeyFrame = keyFrame;
            }
            $('#addKeyFrameButton').removeClass('fa-minus').addClass('fa-plus');
            let playPromise = this.source.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Error playing...', error.name);
                });
            }
        } else {
            let pausePromise = this.source.pause();
            if (pausePromise !== undefined) {
                pausePromise.catch(error => {
                    console.log('Error pausing...', error.name);
                });               
            }
        }
    }
    jumpForwards() {
        this.keyFrames.highlight();   // Remove active state of keyFrame buttons
        let keyFrame = this.keyFrames.next();
        if (keyFrame < 0) {
            keyFrame = this.keyFrames.first();
        }
        $('#addKeyFrameButton').removeClass('fa-minus').addClass('fa-plus');
        this.jumpTo(keyFrame);
    }
    jumpBackwards() {
        this.keyFrames.highlight();   // Remove active state of keyFrame buttons
        let keyFrame = this.keyFrames.previous();
        if (keyFrame < 0) {
            keyFrame = this.keyFrames.last();
        }
        $('#addKeyFrameButton').removeClass('fa-minus').addClass('fa-plus');
        this.jumpTo(keyFrame);
    }
    stepForward(step = 0.04) {
        const index = this.keyFrames.find(this.getCurrentTime());
        if(index >= 0) {
            this.keyFrames.keyframes[index] = parseFloat((this.source.currentTime + step).toFixed(2));
            this.jumpTo(this.source.currentTime + step);
            this.updateKeyFrames(this.keyFrames.keyframes.join());
            this.keyFrames.highlight(this.getCurrentTime());
            curPage.updated = true;
        } else {
            this.jumpTo(this.source.currentTime + step);
        }
    }
    stepBackward(step = 0.04) {
        const index = this.keyFrames.find(this.getCurrentTime());
        if(index >= 0) {
            this.keyFrames.keyframes[index] = parseFloat((this.source.currentTime - step).toFixed(2));
            this.jumpTo(this.source.currentTime - step);
            this.updateKeyFrames(this.keyFrames.keyframes.join());
            this.keyFrames.highlight(this.getCurrentTime());
            curPage.updated = true;
        } else {
            this.jumpTo(this.source.currentTime - step);
        }
    }
    pause() {
        this.source.pause();
    }
    jumpTo(videoTime) {
        this.keyFrames.highlight(videoTime);
        this.currentTime = 0;
        this.nextKeyFrame = -1;
        this.pause();
        this.source.currentTime = videoTime;
    }
    isPaused() {
        return this.source.paused;
    }
    getCurrentTime(numberOfDigits = 2) {
        return this.source.currentTime.toFixed(numberOfDigits);
    }
    getDuration() {
        return this.source.duration;
    }
    setStartPoint(keyFrame) {
        this.keyFrames.keyframes[0] = parseFloat(keyFrame);
        this.updateKeyFrames(this.keyFrames.keyframes.join());
        curPage.updated = true;
    }
    setEndPoint(keyFrame) {
        this.keyFrames.keyframes[this.keyFrames.keyframes.length-1] = parseFloat(keyFrame);
        this.updateKeyFrames(this.keyFrames.keyframes.join());
        curPage.updated = true;
    }
    // Sort a keyFrames string
    updateKeyFrames(keyframes, extraKeyFrame = null) {
        const keyFramesArray = keyframes.split(',');
        if (extraKeyFrame !== null && extraKeyFrame !== '') {
            const newKeyFrame = parseFloat(extraKeyFrame).toString();
            if (keyFramesArray.includes(newKeyFrame)) {
                const index = keyFramesArray.indexOf(newKeyFrame);
                keyFramesArray.splice(index, 1);
                $('#addKeyFrameButton').removeClass('fa-minus');
                $('#addKeyFrameButton').addClass('fa-plus'); 
            } else {
                keyFramesArray.push(extraKeyFrame);
            }
            curPage.updated = true;
        }
        let newKeyFramesArray = [];
        for (let i in keyFramesArray) {
            if (!isNaN(parseFloat(keyFramesArray[i]))) {
                if (parseFloat(keyFramesArray[i]) > curPage.layers[parseInt(curPage.activeAsset) + 1].getDuration()) {
                    newKeyFramesArray.push(curPage.layers[parseInt(curPage.activeAsset) + 1].getDuration().toFixed(2));
                } else {
                    newKeyFramesArray.push(parseFloat(keyFramesArray[i]));
                }
            }
        }
        newKeyFramesArray.sort(function(a,b) { return a - b;});
        const output = newKeyFramesArray.join();
        $('#keyframes').val(output);
        curPage.data.asset[curPage.activeAsset].keyframes = output;
        displayVideoControl(output);
        this.setKeyFrames(output);
        return output;
    }
    draw() {
        canvas.context.drawImage(this.source, this.xScaled, this.yScaled, this.widthScaled, this.heightScaled);
        if (this.name == curPage.activeAsset) {
            if (defineShape(this.shape)) {
                canvas.context.strokeStyle = "#FF00FF";
                canvas.context.stroke();
            } 
        }
        
        // When not in a loop, detect the end and pause
        if (!this.loop && this.getCurrentTime() > this.getDuration() - 0.5) {
            if (this.keyFrames.next() < 0) {
                this.pause();
            }
        } else if (!this.loop && !this.playingBackwards && parseFloat(this.currentTime) > parseFloat(this.getCurrentTime())) {
            this.pause();
            this.jumpTo(this.nextKeyFrame);
            this.currentTime = 0;
        } else {
            this.currentTime = this.getCurrentTime();
        }
        if (this.nextKeyFrame > 0 && this.currentTime >= this.nextKeyFrame) {
            if (this.loop && !this.editing) {
                this.jumpTo(this.keyFrames.previous());
                this.play();
            } else {
                this.pause();
                this.jumpTo(this.nextKeyFrame);
            }
        }
        $(this).css("width", this.widthScaled);
        $(this).css("height", this.heightScaled);
    }
    update() {
        this.xScaled = Math.floor(this.x * canvas.scale);
        this.yScaled = Math.floor((currentStatus.canvasHeight - this.y - this.source.videoHeight * this.scale) * canvas.scale);
        this.widthScaled = Math.floor(this.source.videoWidth * canvas.scale * this.scale);
        this.heightScaled = Math.floor(this.source.videoHeight * canvas.scale * this.scale);
        if (this.clickable) {
            this.shape = {
                name: this.name,
                points: [
                    { x: this.xScaled, y: this.yScaled },
                    { x: (this.xScaled + this.widthScaled), y: this.yScaled },
                    { x: (this.xScaled + this.widthScaled), y: (this.yScaled + this.heightScaled) },
                    { x: this.xScaled, y: (this.yScaled + this.heightScaled) }
                ]
            }
            shapes[this.name] = this.shape;
        }
        this.draw();
    }
}

// Display assets
function drawAssets() {
    canvas.clear();

    // Render background (if available)
    if (curPage.layers[0]) {
        curPage.layers[0].update();
    }
    // Then display the video media
    curPage.layers.slice(1).forEach(layer => {
        if (layer.type == 'video') {
            layer.update();
        };
    });
    if (curPage.layers[parseInt(curPage.activeAsset) + 1] && $('#videoControl').is(':visible')) {
        let selectedAsset = curPage.layers[parseInt(curPage.activeAsset) + 1];
        if (selectedAsset.type == 'video') {
            const currentTime = selectedAsset.getCurrentTime();
            if (!selectedAsset.isPaused()) {
                $('#videoSlider')[0].noUiSlider.set([null, currentTime, null]);
            }
            $('#video_timer').html(`${currentTime}s`);
        }
    }        
    // Finally display the photos on top
    curPage.layers.slice(1).forEach(layer => {
        if (layer.type == 'photo') {
            layer.update();
        }
    });
    // Request the next frame in 1/60th of a second
    requestAnimationFrame(function() {
        drawAssets();
    });
}

class Template {
    constructor() {
        this._name = curPage.data.template;
        this._template = {};
        this.html = curPage.data.html;
        this.fields = curPage.data.fields;
        this.ready = false;
    }
    // Setters and Getters
    set name(value) {
        this._name = value;
        this.initiateTemplate();
    }
    get name() {
        return this._name;
    }
    set template(value) {
        this._template = value;
    }
    get template() {
        return this._template;
    }
    // Initiate template
    initiateTemplate() {
        const index = 0;
        this.template = currentStatus.templates[index];
    }
    // Setting a new template with default field values
    setTemplate(template) {
        $('#videoControl').hide();
        const id = curPage.data.id;
        this.name = template;
        this.fields = null;
        curPage.data = {};
        if (template != '') {
            for (let templateId in currentStatus.templates) {
                if (currentStatus.templates[templateId].template == this.name) {
                    curPage.data = $.extend(true, {}, currentStatus.templates[templateId]); // Make a deep copy of the fields
                    delete curPage.data.filePath;
                    if (currentStatus.templates[templateId].fields) {
                        this.fields = $.extend(true, {}, currentStatus.templates[templateId].fields);
                     }
                    break;
                }
            }
        }
        curPage.data.id = id;
        curPage.data.unSaved = true;

        // Bring the iframe upfront when no assets are detected
        if (!curPage.data.asset) {
            $('iframe').css('z-index', 0);
        } else {
            $('iframe').css('z-index', -10);
        }
        curPage.updated = true;
        showPageInfo();
        drawNavigationAids();
        this.ready = false;
        this.draw();
        drawPage();
        this.setFieldsInput();
    }
    // Setting the HTML background
    setHtml(html) {
        this.html = html;
        curPage.data.fields = null;
        curPage.updated = true;
        this.ready = false;
        this.draw();
        this.setFieldsInput();
    }
    setField(id, value) {
        if (value.url) {
            if (value.url == -1) {
                this.fields[id].url = "";
                curPage.data.fields[id].url = "";               
            } else {
                this.fields[id].url = value.url;
                curPage.data.fields[id].url = value.url;
            }
        }
        if (value.transition) {
            this.fields[id].transition = value.transition;
            curPage.data.fields[id].transition = value.transition;
        }
        if (value.content || value.content == '') {
            this.fields[id].content = value.content;
            curPage.data.fields[id].content = value.content;
        }
        this.updateFields();
        curPage.updated = true;
    }
    updateFields() {
        const self = this;
        if (this.fields) {
            Object.keys(this.fields).forEach(function(fieldId) {
                const fieldType = self.fields[fieldId].type;
                const fieldContent = self.fields[fieldId].content;
                const fieldUrl = self.fields[fieldId].url;
                const fieldTransition = self.fields[fieldId].transition;
                if (fieldType == 'span' || fieldType == 'li' || fieldType == 'div' ) {
                    $( "#canvasHtml" ).contents().find("#" + fieldId).html(fieldContent);                
                } else if (fieldType == 'img') {
                    if (fieldContent == '' || Object.keys(fieldContent).length === 0) {
                        $( "#canvasHtml" ).contents().find("#" + fieldId).removeAttr('src');
                        $( "#canvasHtml" ).contents().find("#" + fieldId).css('display', 'none');
                    } else if (!fieldContent.includes('..')) {
                        $( "#canvasHtml" ).contents().find("#" + fieldId).attr('src', currentStatus.presentationFolder + currentStatus.projectName + '/' + fieldContent);
                        $( "#canvasHtml" ).contents().find("#" + fieldId).css('display', 'block');
                    } else {
                        $( "#canvasHtml" ).contents().find("#" + fieldId).attr('src', fieldContent);
                        $( "#canvasHtml" ).contents().find("#" + fieldId).css('display', 'block');
                    }
                } else if (fieldType == 'a') {
                    if (fieldContent != '') {
                        $( "#canvasHtml" ).contents().find(`#${fieldId}`).html(fieldContent);
                        if (fieldUrl && fieldUrl != '') {
                            $( "#canvasHtml" ).contents().find(`#${fieldId}`).attr('page', fieldUrl);
                            $( "#canvasHtml" ).contents().find(`#${fieldId}`).attr('transition', fieldTransition);
                        }
                        $( "#canvasHtml" ).contents().find(`#${fieldId}`).show();
                    } else if (self.fields[fieldId].hasOwnProperty('content')) {
                        $( "#canvasHtml" ).contents().find(`#${fieldId}`).hide();
                    }          
                }
            });
            this.resetAnimation();
            this.startAnimation();
        }
    }
    draw() {
        if (this.html) {
            let url = this.html;
            $('#canvas').css('background', 'none');
            $('#canvasHtml').attr('src', url);
            $('#canvasHtml').show();
        } else if (this._name && this._name.endsWith('.html')) {
            if (!this.ready) {
                let self = this;
                let url = this._name;
                if (curPage.data.hasOwnProperty('unSaved') && curPage.data.unSaved == true) {
                    url = '.' + currentStatus.templatesFolder + 'html/' + url;
                    console.log('based on template ', url);
                } else {
                    url = '.' + currentStatus.presentationFolder + currentStatus.projectName + '/page_' + curPage.data.id + '.html';
                    console.log('based on HTML copy ', url);
                    if (curPage.data.hasOwnProperty('unSaved') && curPage.data.unSaved == false) {
                        curPage.data.unSaved = undefined;
                        delete curPage.data.unSaved;
                    }
                }
                $('#canvas').css('background', 'none');
                $('#canvasHtml').hide();
                $('#canvasHtml').attr('src', url);
                $('#canvasHtml').off();
                $('#canvasHtml').on('load', function() { 
                    self.updateFields();
                    $('#canvasHtml').show();
                    self.ready = true;
                    // TODO: I just do not understand why I need a setTimeout to get this to work
                    setTimeout(function() {
                        self.resetAnimation();
                        self.startAnimation();
                    }, 0);
                });
            } else {
                this.updateFields();                    
            }

        } else {
            $('#canvas').css('background', 'black');
            $('#canvasHtml').hide();
        }
    }
    startAnimation() {
        if (typeof $('#canvasHtml')[0].contentWindow.startSlide == 'function') {
            $('#canvasHtml')[0].contentWindow.startSlide();
        }
    }
    resetAnimation() {
        if (typeof $('#canvasHtml')[0].contentWindow.startSlide == 'function') {
            $('#canvasHtml')[0].contentWindow.resetSlide();
        }
    }
    setFieldsInput() {
        // Remove all previous fields and associated events
        $('#fieldsForm').find('.activeEvent').off();
        $('#fieldsForm').empty();
        if(this.fields) {
            let self = this;
            $('#fieldsForm').append('<div id="getTweet"><i class="fab fa-twitter fa-3x"></i></div>');
            $('#getTweet').hide();            
            $('#getTweet').off();
            Object.keys(this.fields).forEach(function(fieldId) {
                const fieldType = self.fields[fieldId].type;
                if (!fieldId.startsWith('_')) {
                    let fieldContent = self.fields[fieldId].content;
                    if (typeof fieldContent != 'string') {
                        fieldContent = '';
                    };
                    const fieldTransition = self.fields[fieldId].transition;
                    $('#fieldsForm').append(`<div id="${fieldId}_wrapper"></div>`);
                    $(`#${fieldId}_wrapper`).html(`<label for="edit_${fieldId}">${fieldId.replace(/_/g, ' ')}</label><br>`);
                    if (fieldType != 'img' && self.fields[fieldId].hasOwnProperty('content')) {
                        if (self.fields[fieldId].long) {
                            $(`#${fieldId}_wrapper`).append(`<textarea id="edit_${fieldId}" class="textArea">${fieldContent}</textarea>`);
                        } else {
                            $(`#${fieldId}_wrapper`).append(`<input type="text" id="edit_${fieldId}" class="textField" value="${fieldContent}" />`);
                        }
                    }
                    if (fieldType == 'a') {
                        $(`#${fieldId}_wrapper`).append(`<select id="${fieldId}Selector"></select>`);
                        createPageSelector(fieldId, curPage.data.fields);
                        // TRANSITIONS FOR LINKS
                        $(`#${fieldId}_wrapper`).append(`<select id="edit_${fieldId}_trans"></select>`);
                        // Repopulate Transition select dropdown
                        $(`#edit_${fieldId}_trans`).empty();
                        for (let key in TRANSITIONS) {
                            if (TRANSITIONS.hasOwnProperty(key)) {
                                $(`#edit_${fieldId}_trans`).append('<option value="' + key + '">' + TRANSITIONS[key] + '</option>');
                            }
                        }
                        $(`#edit_${fieldId}_trans`).prop('disabled', false);
                        if (fieldTransition) {
                            $(`#edit_${fieldId}_trans`).val(fieldTransition);
                        } else {
                            $(`#edit_${fieldId}_trans`).val('none');
                        }
                    } else if(fieldType == 'img') {
                        $(`#${fieldId}_wrapper`).append(`<img id="${fieldId}Selector" />`);
                        createImageSelector(fieldId, curPage.data.fields, curPage.template.fields);
                    }
                
                    if (self.fields[fieldId].hasOwnProperty('content')) {
                        $('#edit_' + fieldId).off();
                    }

                    if (fieldType == 'span' || fieldType == 'div' ) {
                        $(`#edit_${fieldId}`).addClass('activeEvent');
                        $(`#edit_${fieldId}`).on('change keyup', function() {
                            const newValue = $(this).val();
                            self.setField(fieldId, {content: newValue});
                        });
                    } else if (fieldType == 'a') {
                        if (self.fields[fieldId].hasOwnProperty('content')) {
                            $(`#edit_${fieldId}`).addClass('activeEvent');
                            $(`#edit_${fieldId}`).on('change keyup', function() {
                                const newValue = $(this).val();
                                self.setField(fieldId, {content: newValue});
                            });
                        }
                        $(`#edit_${fieldId}_trans`).addClass('activeEvent');
                        $(`#edit_${fieldId}_trans`).on('change', function(event) {
                            let newTransition = $(this).val();
                            self.setField(fieldId, {transition: newTransition});
                        });
                    } else if (fieldType == 'li') {
                        $(`#edit_${fieldId}`).addClass('activeEvent');
                        $(`#edit_${fieldId}`).on('change keyup', function() {
                            const newValue = $(this).val();
                            self.setField(fieldId, {content: newValue});
                        });
                    }
                } else if (fieldType == 'keywords') {
                    const keyWords = self.fields[fieldId].content.split(',');
                    if (keyWords.indexOf('Twitter') != -1) {
                        $('#getTweet').show();
                        $('#getTweet').on('click', function() {
                            let link = '';
                            if (curPage.data.fields.hasOwnProperty('_link')) {
                                link = curPage.data.fields['_link'];
                            }
                            $('#message').html('<h3>Voer Tweet URL in:</h3>');
                            $('#message').append(`<input type="text" id="tweetId" value="${link}">`);
                            $('#dialog-message').dialog({
                                dialogClass: "no-close",
                                width: 600,
                                height: 250,
                                maxWidth: 600,
                                maxHeight: 250,
                                title: 'Twitter plug-in',
                                modal: false,
                                buttons: {
                                    OK: function() {
                                        $('#tweetId').trigger('change');
                                        $(this).dialog("close");
                                    },
                                    Annuleren: function() {
                                        $(this).dialog("close");
                                    }
                                }
                            });
                            $('#tweetId').on('change', function() {
                                const url = $(this).val();
                                if (url) {
                                    socket.emit('getTweet', url);
                                }
                            });
                            $('#tweetId').on('contextmenu', function(event) {
                                event.stopPropagation();
                            });
                        });
                    }
                };
            });
            $('#fieldsInfo').show();
        } else {
            $('#fieldsInfo').hide();
        }
    }
}

// Refresh current pagers
function drawPage() {
    if (currentStatus.pageIds && currentStatus.pageIds.length > 0) {
        // Clear the active region path
        canvas.context.beginPath();

        // Stop all video's
        $("video").each(function() {
            $(this).get(0).pause();
        });
        $("video").remove();
        curPage.clearLayers();

        // Update canvas
        $('#canvas').show();

        // Display HTML template
        curPage.template.draw();

        // Display background image
        if (curPage.data.background) {
            let backgroundUrl = currentStatus.presentationFolder + currentStatus.projectName + '/' + curPage.data.background;
            if (isVideo(curPage.data.background)) {
                $('html').append(`<video id="video_background" src="${backgroundUrl}" controls="false" autoplay="true" loop="true" style="display: none;"></video>`);

                let widthCanvas, heightCanvas, xPosCanvas, yPosCanvas;

                $('#video_background').on('loadedmetadata', function() {
                    widthCanvas = Math.floor(this.videoWidth);
                    heightCanvas = Math.floor(this.videoHeight);
                    xPosCanvas = Math.floor(0);
                    yPosCanvas = Math.floor(0);
                    $(this).css("width", widthCanvas);
                    $(this).css("height", heightCanvas);
                    const scaleBackground = currentStatus.canvasWidth / widthCanvas;
                    curPage.layers[0] = new Video(this, xPosCanvas, yPosCanvas, scaleBackground);
                    curPage.layers[0].loop = true;
                    curPage.layers[0].clickable = false;
                });
            } else {
                curPage.layers[0] = new Photo(backgroundUrl, 0, 0, 1.0, 'back');
                curPage.layers[0].clickable = false;
                curPage.layers[0].fit = true;
            }
        } else {
            curPage.layers[0] = null;
        }

        // Reset shapes list (defining active area's)
        shapes.length = 0;

        // TODO: This should happen each time the data gets updated in a more central place
        // Ensure that asset is an array
        if (curPage.data.asset && !Array.isArray(curPage.data.asset)) {
            let temp = curPage.data.asset;
            curPage.data.asset = [];
            if (temp) {
                curPage.data.asset.push(temp);
            }
        }

        // Display assets (if any)
        for (let i in curPage.data.asset) {
            let assetContent = curPage.data.asset[i];
            let imageValid = false;
            if (assetContent.img) {
                imageValid = true;
            }
            let xpos = assetContent.xpos;
            let ypos = assetContent.ypos;
            let assetScale = (assetContent.scale ? assetContent.scale : 1.0);
            let name = i;

            if (imageValid && isVideo(assetContent.img)) {
                let videoFile = currentStatus.presentationFolder + currentStatus.projectName + '/' + assetContent.img
                $('html').append(`<video id="video_${name}" src="${videoFile}" controls="false" autoplay="true" loop="false"></video>`);
                $(`#video_${name}`).hide();
                $(`#video_${name}`).off();
                $(`#video_${name}`).on('loadedmetadata', function() {
                    let vid = new Video(this, xpos, ypos, assetScale, name);
                    if (assetContent.keyframes) {
                        vid.setKeyFrames(assetContent.keyframes);
                    } else {
                        vid.setKeyFrames(`0.00,${vid.getDuration().toFixed(2)}`);
                        assetContent.keyframes = `0.00,${vid.getDuration().toFixed(2)}`;
                    }
                    if (assetContent.loop) {
                        vid.loop = (assetContent.loop != 'once');
                    } else {
                        vid.loop = true;
                    }
                    vid.pause();
                    vid.jumpTo(vid.keyFrames.first());
                    vid.play();
                    curPage.layers[parseInt(name) + 1] = vid;
                    // When video asset is active, automatically show the video control window
                    if (name == curPage.activeAsset) {
                        displayVideoControl(assetContent.keyframes);
                        $('#videoControl').show();
                    }
                });
                $(`#video_${name}`).on('pause', function() {
                    $('#playPauseButton').removeClass('fa-pause');
                    $('#playPauseButton').addClass('fa-play');             
                $('#playPauseButton').addClass('fa-play');             
                    $('#playPauseButton').addClass('fa-play');             
                });
                $(`#video_${name}`).on('play', function() {
                    $('#playPauseButton').removeClass('fa-play');
                    $('#playPauseButton').addClass('fa-pause');               
                $('#playPauseButton').addClass('fa-pause');               
                    $('#playPauseButton').addClass('fa-pause');               
                });

            } else {
                let imagePath = "";
                if (imageValid) {
                    if (LIVE_VIDEO_TAGS.includes(assetContent.img)) {
                        imagePath = LIVE_VIDEO_IMAGES[LIVE_VIDEO_TAGS.indexOf(assetContent.img)];
                    } else {
                        imagePath = currentStatus.presentationFolder + currentStatus.projectName + '/' + assetContent.img;
                    }
                } else {
                    imagePath = NO_MEDIA_IMAGE;
                }
                let image = new Photo(imagePath, xpos, ypos, assetScale, name);
                curPage.layers[parseInt(name) + 1] = image;
            }
        }
    } else {
        // Clear the whole page
        curPage.reset();
    }
}

function drawNavigationAids() {
    let navArray = ['back', 'next', 'up', 'down'];
    for (let directionId in navArray) {
        const direction = navArray[directionId];
        if (curPage.data[direction]) {
            const switchTo = curPage.data[direction];
            $(`#swipe_${direction}`).css('visibility', 'visible');
            $(`#swipe_${direction}`).off();
            $(`#swipe_${direction}`).on('click', function() {
                switchPage(switchTo);
                toggleRightBar(false);
            });
        } else {
            $(`#swipe_${direction}`).css('visibility', 'hidden');
            $(`#swipe_${direction}`).off();
        }
    }
}

function refreshAsset(assetId) {
    console.log('refreshAsset', assetId);
    if (assetId != undefined) {
        let assetContent = (Array.isArray(curPage.data.asset) ? curPage.data.asset[assetId] : curPage.data.asset);

        // In case a new asset was just added
        if (assetId >= curPage.layers.length - 1) {
            let image = new Photo(NO_MEDIA_IMAGE, 0, 0, 1.0, assetId);
            curPage.layers.push(image);
        }

        // Refresh page and highlight asset
        for (let i = 1; i < curPage.layers.length; i++) {
            if(curPage.layers[i].name == assetId) {
                curPage.layers[i].x = assetContent.xpos;
                curPage.layers[i].y = assetContent.ypos;
                if (assetContent.scale) {
                    curPage.layers[i].scale = assetContent.scale;
                }
            }
        }

        // Make chosen asset active in Assets List
        $("#assets").val(assetId).find("option[value=" + assetId +"]").attr('selected', true);

        curPage.activeAsset = assetId;
        showAssetInfo(assetId, assetContent);
    }
}

// Display pages bar
function displayPagesBar(singlePage = null) {
    console.log(`Refresh displayPagesBar ${singlePage}.`);
    if (singlePage) {
        if (singlePage == '-1') singlePage = '0';
        let pageId = currentStatus.pageIds[singlePage].replace(/_/g, ' ');
        const thumbnail = 'page_' + currentStatus.pageIds[singlePage] + '_small.png';
        $(`#page_${singlePage}`).html(`<img src="${encodeURIComponent(currentStatus.presentationFolder + currentStatus.projectName + '/screenshots/' + thumbnail) + '?t=' + new Date().getTime()}" height="80" draggable="false"><br /><div class="pageId">${pageId}</div>`);
        return;
    }
    $('#pages').empty();
    for (let page in currentStatus.pageIds) {

        // Add page IDs to bar
        let pageIndex = page;
        let pageId = currentStatus.pageIds[page].replace(/_/g, ' ');
        let thumbnail = 'page_' + currentStatus.pageIds[page] + '_small.png';
        if (thumbnail in currentStatus.screenshots) {
            $('#pages').append('<li><a id = "page_' + pageIndex + '" href="#top" draggable="false"><img src="' + encodeURIComponent(currentStatus.presentationFolder + currentStatus.projectName + '/screenshots/' + thumbnail) + '?t=' + new Date().getTime() + '" height="80" draggable="false"><br /><div class="pageId">' + pageId + '</div></a></li> ');
        } else {
            $('#pages').append('<li><a id = "page_' + pageIndex + '" href="#top" draggable="false"><div id="pageId">' + pageId + '</div></a></li> ');
        }
        if (pageId == currentStatus.pageIds[curPage.index]) {
            $('#page_' + pageIndex).addClass('active');
        }

        // Add listener to switch page
        $('#page_' + pageIndex).on('click', function(event) {
            event.preventDefault();
            switchPage(currentStatus.pageIds[pageIndex]);
            toggleRightBar(false);
        });

        // Add listener for right-click
        $('#page_' + pageIndex).on('contextmenu', function(event) {
            // Avoid standard context menu
            event.preventDefault();

            // Compose the custom menu
            $('#popup').html(`<li class="disabled">Verplaats ${currentStatus.pageIds[pageIndex]}</li>`);
            for (let i in currentStatus.pageIds) {
                if (i != pageIndex && i != (pageIndex - 1)) {
                    $('#popup').append(`<li id="na${i}">Na ${currentStatus.pageIds[i]}</li>`);
                    $(`#na${i}`).off();
                    $(`#na${i}`).on('click', function() {
                        $('#popup').hide(100); // Hide dropdown menu
                        curPage.move(pageIndex, i);
                    });
                }
            }
            $('#popup').append('<li class="disabled"></li>');
            if (pageIndex < currentStatus.pageIds.length - 1) {
                $('#popup').append('<li id="moveRight"><i class="fas fa-arrow-right"></i> Naar rechts</li>');
            }
            if (pageIndex > 0) {
                $('#popup').append('<li id="moveLeft"><i class="fas fa-arrow-left"></i> Naar links</li>');
            }
            $('#popup').append('<li class="disabled"></li>');
            $('#popup').append('<li id="delete"><i class="fa fa-trash" aria-hidden="true"></i> Verwijder</li>');
            // Show contextmenu
            $('#popup').finish().toggle(100).

            // In the right position (the mouse)
            css({
                top: (Number(event.pageY) - $('#menu-bar').height() - (currentStatus.pageIds.length + 2) * 41) + "px",
                left: (Number(event.pageX) - $('#sidebar-left').width()) + "px"
            });

            // Define callback function moving current page to the left
            $('#moveLeft').on('click', function() {
                $('#popup').hide(100); // Hide dropdown menu
                curPage.swap(pageIndex, Number(pageIndex) - 1);
            });

            // Define callback function moving current page to the right
            $('#moveRight').on('click', function() {
                $('#popup').hide(100); // Hide dropdown menu
                curPage.swap(pageIndex, Number(pageIndex) + 1);
            });

            // Define callback function for applying template to a new page
            $('#delete').on('click', function() {
                $('#popup').hide(100); // Hide dropdown menu
                deletePage(pageIndex);
            });
        });
    }

    // Add page button
    $('#pages').append('<li><a id = "page_x" href="#top" draggable="false"><img src="/img/add-icon.png" height="80" draggable="false"><br />&nbsp;</a></li>');

    // Add listener to Add Page button
    $('#page_x').on('click', function() {
        // createPage();
        switchToTab('media');
    });

    // Disable drag over actions
    $('#page_x').on('dragover', function(event) {
        event.preventDefault();
    });

    $('#page_x').on('drop', function(event) {
        event.stopPropagation();
        const data = "image_" + event.originalEvent.dataTransfer.getData('text').split('_')[1];
        const imageName = document.getElementById(data).dataset.value;

        // Compose the custom menu
        // Create full video template and add video
        $('#popup').empty();
        if (isVideo(imageName)) {
            $('#popup').append('<li id="fullVideo">Full video</li>');
            $('#fullVideo').on('click', function() {
                addNewPagewWithTemplate('Tokio_full.json', imageName);
                $('#popup').hide(100); // Hide it AFTER the action was triggered
            });
            $('#popup').append('<li id="flexVideo">Flex video</li>');
            $('#flexVideo').on('click', function() {
                addNewPagewWithTemplate('Tokio_flex.json', imageName);
                $('#popup').hide(100); // Hide it AFTER the action was triggered
            });
            // // Create doorlezer video template and add video
            // $('#popup').append('<li id="doorlezerVideo">Doorlezer</li>');
            // $('#doorlezerVideo').on('click', function() {
            //     addNewPagewWithTemplate('doorlezer.json', imageName);
            //     $('#popup').hide(100); // Hide it AFTER the action was triggered
            // });
        } else {
            $('#popup').append('<li id="fullPhoto">Full foto</li>');
            $('#fullPhoto').on('click', function() {
                addNewPagewWithTemplate('Tokio_full.json', imageName);
                $('#popup').hide(100); // Hide it AFTER the action was triggered
            });
            $('#popup').append('<li id="flexVideo">Flex foto</li>');
            $('#flexPhoto').on('click', function() {
                addNewPagewWithTemplate('Tokio_flex.json', imageName);
                $('#popup').hide(100); // Hide it AFTER the action was triggered
            });            
        }

        // Show contextmenu
        $('#popup').finish().toggle(100).

        // In the right position (the mouse)
        css({
            top: (Number(event.pageY) - $('#menu-bar').height()) + "px",
            left: (Number(event.pageX) - $('#sidebar-left').width()) + "px"
        });
    });

    // Scroll page bar
    let isDown = false;
    let startX;
    let scrollLeft;
    $('#pages').on('mousedown', (event) => {
        startX = event.pageX - $('#pages')[0].offsetLeft;
        scrollLeft = $('#pages')[0].scrollLeft;
        isDown = true;
    });
    $('#pages').on('mouseup mouseleave', () => {
        isDown = false;
        $('#pages').removeClass('scrolling');
    });    
    $('#pages').on('mousemove', (event) => {
        if (!isDown) return;
        event.preventDefault();
        const x = event.pageX - $('#pages')[0].offsetLeft;
        const walk = (x - startX) * 3;
        if (Math.abs(x - startX) > 10) {
            $('#pages').addClass('scrolling');
            $('#pages')[0].scrollLeft = scrollLeft - walk;
        }
    });
}

socket.on('connect', function() {
    sessionId = getCookie('sessionId');
    console.log('Previous session: ', sessionId);
    console.log('Session: ', socket.io.engine.id);
    document.cookie = `sessionId=${socket.io.engine.id}`;
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
        if (sessionId) {
            idCard.sessionId = sessionId;
        }
        socket.emit('user', idCard);
    }
    console.log('Request for identification.');
});

socket.on('renderedPage', function(pageName) {
    console.log(`renderedPage ${pageName}`);
    currentStatus.data[pageName].unSaved = false;
});

socket.on('status', function(msg, updatedPage = null) {
    if (msg.projectName && pagePrepared) {
        console.log('Status');
        console.log(msg);
        let showPagesBar = false;
        if (msg.projectName != currentStatus.projectName) {
            if (msg.pageIds.length > 0) {
                curPage.index = 0;  // Startpage
            } else {
                curPage.index = -1; // Empty page
            }
            curPage.reset();
            history.clear();
            showPagesBar = true;

            // Set scale to null in order to trigger zoomToFit
            canvas.scale = null;
        }
        currentStatus = msg;

        // Exception when pages were deleted
        if (curPage.index >= currentStatus.numberOfPages) {
            curPage.index = 0;
        }
        setupCanvas();
        if (showPagesBar) {
            displayPagesBar();
        }
        displayMedia();
        displayTemplates();
        if (updatedPage == currentStatus.pageIds[curPage.index]) {
            curPage.loadCurrentPage();
            drawPage();
        }
        network.calculateNetwork(currentStatus);
    } else {
        if (!pagePrepared) {
            console.log('Not ready yet...');
        } else {
            console.log('Empty status received.');
        }
    }

});

socket.on('projectReady', function() {
    if (!settingsOnly) {
        $('#projectTitle').text(currentStatus.projectName);
        toggleRightBar(false);
        // Show page info on right side bar
        $('#pageInfo').show();
        // Show all edit buttons on left side bar
        $('#viewerButton').show();
        $('#templatesButton').show();    
        $('#mediaButton').show();  
        $('#networkButton').show();
        $('#xmlButton').show();
        $('#syncButton').show();
        $('#archiveButton').show();
        switchToTab('viewer');
    } else {
        $('#projectTitle').text('');
        $('#viewerButton').hide();
        $('#templatesButton').hide();    
        $('#mediaButton').hide();  
        $('#networkButton').hide();
        $('#xmlButton').hide();
        $('#syncButton').hide();
        $('#archiveButton').hide();
        settingsOnly = false;
    }
});

socket.on('updateProjects', function(update, presentationFolder) {
    if (!currentStatus.presentationFolder) {  // TODO: workaround for getting a projects list prior to a status
        currentStatus.presentationFolder = presentationFolder;
    }
    projects.listProjects(update);
});

socket.on('media', function(msg) {
    currentStatus.media = msg;
    displayMedia();
});

socket.on('consolidatedMedia', function(msg) {
    popUpMessage();
    drawPage();
});

socket.on('templates', (msg) => {
    currentStatus.templates = msg;
    displayTemplates();
    console.log('New templates received', msg);
});

socket.on('dropfolder', (videoName, videoData) => {
    if (currentStatus.media) {
        if (videoData == 'delete') {
            delete currentStatus.media[videoName];
        } else {
            currentStatus.media[videoName] = {};
            currentStatus.media[videoName] = videoData;
        }
    }
    displayMedia();
});

socket.on('screenshots', function(screenshots) {
    let exclusive = null
    for (let name in screenshots) {
        // Compare the timeStamps
        if (currentStatus.screenshots && 
            currentStatus.screenshots[name] && 
            currentStatus.screenshots[name] != screenshots[name]) {
            exclusive = currentStatus.pageIds.indexOf(name.slice(5, -10));
            break;
        }
    }
    currentStatus.screenshots = screenshots;
    if ($('#pages').is(':visible')) {
        displayPagesBar(exclusive);
    }
    network.calculateNetwork(currentStatus);
});

socket.on('page', function(page) {
    if(page != curPage.index) {
        switchPage(currentStatus.pageIds[page >= 0 ? page : 0], false);
    }
});

socket.on('deleted', function(page) {
    const index = currentStatus.pageIds.indexOf(page);
    if (index != -1) {
        currentStatus.pageIds.splice(index, 1);
    }
});

socket.on('message', function(message) {
    popUpMessage(message);
});

socket.on('usersUpdate', function(message) {
    $('.userAvatar').remove();
    for (let i in message) {
        const emailAddress = message[i];
        if (emailAddress != userName) {
            const imageURL = `https://www.gravatar.com/avatar/${MD5(emailAddress)}?size=40&d=monsterid&forcedefault=y`;
            $('#iconsBar').prepend(`<li class="userAvatar"><img src="${imageURL}" title="${emailAddress}"</li>`);
        }
    }
});

socket.on('tweet', function(tweetBody) {
    // Profile imafe
    console.log(tweetBody);
    const imageName = tweetBody.user.local_copy_image;
    curPage.data.fields['Profielfoto'].content = imageName;
    curPage.data.fields['_link'] = tweetBody.link;
    curPage.template.fields['Profielfoto'].content = imageName;
    $('#ProfielfotoSelector').attr('src', getMediaPath(imageName));
    $('#ProfielfotoSelector').attr('title', imageName);
    // Media
    if (tweetBody.local_media) {
        for (let i = 0; i < 5; i++) {
            const index = parseInt(i) + 1;
            if (i < tweetBody.local_media.length) {
                const mediaName = tweetBody.local_media[i];
                curPage.data.fields[`Afbeelding_${index}`].content = mediaName;
                curPage.template.fields[`Afbeelding_${index}`].content = mediaName;
                $(`#Afbeelding_${index}Selector`).attr('src', getMediaPath(mediaName));
                $(`#Afbeelding_${index}Selector`).attr('title', mediaName);
            } else {
                curPage.data.fields[`Afbeelding_${index}`].content = '';
                curPage.template.fields[`Afbeelding_${index}`].content = '';
                $(`#Afbeelding_${index}Selector`).attr('src', '');
                $(`#Afbeelding_${index}Selector`).attr('title', 'Placeholder');
            }
        }   
    }
    // Tweet tekst
    $('#edit_Tekst').val(tweetBody.text).trigger('change');
    // Author name
    $('#edit_Twitter-naam').val(tweetBody.user.name).trigger('change');
    // Author handle
    $('#edit_Twitter-handle').val(`@${tweetBody.user.screen_name}`).trigger('change');
    // Number of retweets
    $('#edit_Aantal_retweets').val(`${tweetBody.retweet_count}`).trigger('change');
    // Number of quotes
    $('#edit_Aantal_quotes').val(`${tweetBody.retweet_count}`).trigger('change');
    // Number of quotes
    $('#edit_Aantal_likes').val(`${tweetBody.favorite_count}`).trigger('change');
    // Date published
    const datePublished = new Date(Date.parse(tweetBody.created_at.replace(/( \+)/, ' UTC$1')));
    const dateOptions= { dateStyle: 'full', timeStyle: 'short' };
    $('#edit_datum_tweet').val(`${new Intl.DateTimeFormat('nl-BE', dateOptions).format(datePublished)}`).trigger('change');
    drawPage();
});
