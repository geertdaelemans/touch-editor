export default class Keyframes {
    constructor(video) {
        this._video = video;
        this._keyframes = null;
    }
    get keyframes() {
        return this._keyframes;
    }
    set keyframes(keyframes) {
        this._keyframes = keyframes;
    }
    set(keyframes) {
        this.keyframes = keyframes;
    }
    // Search for keyframe and returns index if found, -1 if not found
    find(keyframe) {
        const key = parseFloat(keyframe).toFixed(2);
        for (let i in this.keyframes) {
            if (key == parseFloat(this.keyframes[i]).toFixed(2)) {
                return i;
            }
        }
        return -1;
    }
    // Get next keyframe time, returns -1 if not found
    next() {
        if (this.keyframes) {
            const currentTime = parseFloat(this._video.getCurrentTime());
            for (let i in this.keyframes) {
                const keyframeTime = parseFloat(this.keyframes[i]);
                if (keyframeTime > currentTime) {
                    return keyframeTime;
                }
            }
        }
        return -1;
    }
    // Get previous keyframe time, returns -1 if not found
    previous() {
        if (this.keyframes) {
            const currentTime = parseFloat(this._video.getCurrentTime());
            for(let i = this.keyframes.length - 1; i >= 0; i--) {
                if (parseFloat(this.keyframes[i]) < currentTime) {
                    return parseFloat(this.keyframes[i]);
                }
            }
        }
        return -1;
    }
    // Get first keyframe time, returns 0.0 if not found
    first() {
        if (this.keyframes && this.keyframes.length > 0) {
            return parseFloat(this.keyframes[0]);
        }
        return 0.0;
    }
    // Get last keyframe time, returns 0.0 if not found
    last() {
        if (this.keyframes && this.keyframes.length > 0) {
            return parseFloat(this.keyframes[this.keyframes.length - 1]);
        }
        return 0.0;
    }
    // Highlights keyframe when cursor is on top or removes
    // highlight when already selected. When no keyframe is selected, it removes
    // all highlights.
    highlight(keyFrame = null) {
        $(`.keyFrameButton`).removeClass('active');
        $('.noUi-value').removeClass('active');
        if (keyFrame != null) {
            const point = this.find(keyFrame);
            if (point >= 0) {
                $(`#pip_${point}`).addClass('active');
                $('#addKeyFrameButton').removeClass('fa-plus');
                $('#addKeyFrameButton').addClass('fa-minus');    
            }
        }
    }
    // Deletes a specific keyframe.
    delete(keyFrame) {
        const index = this.find(keyFrame);
        if (index >= 0) {
            this.keyframes.splice(index, 1);
        }
    }
}