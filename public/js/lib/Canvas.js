// export default class Canvas {
export default class Canvas {
    constructor(canvasId) {
        this._context = $(`#${canvasId}`)[0].getContext('2d');
        this._width = 0;
        this._height = 0;
        this._presentationWidth = 0;
        this._presentationHeight = 0;
        this._scale = 1.0;
    }
    get context() {
        return this._context;
    }
    get width() {
        return this._width;
    }
    get height() {
        return this._height;
    }
    get presentationWidth() {
        return this._presentationWidth;
    }
    set presentationWidth(width) {
        this._presentationWidth = width;
    }
    get presentationHeight() {
        return this._presentationHeight;
    }
    set presentationHeight(height) {
        this._presentationHeight = height;
    }
    get scale() {
        return this._scale;
    }
    set scale(scale) {
        this._scale = scale;
    }
    get left() {
        return $(`#canvas`)[0].getBoundingClientRect().left;
    }
    get top() {
        return $(`#canvas`)[0].getBoundingClientRect().top;
    }

    setSize(width, height) {
        this.presentationWidth = width;
        this.presentationHeight = height;
    }

    zoomToFit() {
        // Calculate fit to windows scale
        const containerWidth = ($(window).width() - $('#sidebar-left').width());
        const containerHeight = ($('#sidebar-left').height() - 318);   // TODO: This is a guestimate, should calculate margin
        const widthMargin = $('#swipe_back').width() + $('#swipe_next').width() + 20;
        const maxWidth = containerWidth - widthMargin;
        const containerRatio = containerWidth / containerHeight;
        const ratio = this.presentationWidth / this.presentationHeight;
        if (ratio > containerRatio) {
            // Canvas smaller than window / width larger than height
            if (this.presentationWidth < maxWidth) {
                this.scale = 1.0;
            // Canvas larger than window / width larger than height           
            } else {
                this.scale = maxWidth / parseFloat(this.presentationWidth);
            }
        } else {
            // Canvas smaller than window / width smaller than height
            if (this.presentationHeight < containerHeight) {
                this.scale = 1.0;
            // Canvas larger than window / width smaller than height            
            } else {
                this.scale = containerHeight / parseFloat(this.presentationHeight);     
            }        
        }

        // Set the zoom slider
        $('#zoomSlider').slider('value', this.scale * 100);
        $('#zoomValue').html(`Zoom: ${(this.scale * 100).toFixed(0)}%`);

        // Effectively resize the canvas
        this.resize();
    }

    resize(zoom = null) {
        // When no scale is defined, fit the canvas in the available space
        if (zoom) {
            this.scale = zoom / 100.0;
            $('#zoomValue').html(`Zoom: ${zoom}%`);
        } else if (!this.scale) {
            this.zoomToFit();
            return;
        }

        // Calculate the dimensions of the canvas and set it
        this._width = this.presentationWidth * this.scale;
        this._height = this.presentationHeight * this.scale;
        this.context.canvas.width = this.width;
        this.context.canvas.height = this.height;

        // Size properties needs to be set for html2 canvas to work
        $('#canvasHtml').prop('width', this.width);
        $('#canvasHtml').prop('height', this.height);
        
        $('#screenshotArea').css('width', this.width);
        $('#screenshotArea').css('height', this.height);
        $('#canvasHtml').css('top', (-Number(this.height) - 24) + 'px');
        $('#canvasHtml').css('margin-bottom', (-Number(this.height)) + 'px');
    
        $('#swipe_down').css('width', this.width);
        $('#swipe_up').css('width', this.width);
        $('#canvas').css('display', 'block');
    }

    clear() {
        // Clear canvas
        this.context.clearRect(0, 0, this.width, this.height);
    }
}