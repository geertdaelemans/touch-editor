export default class History {
    constructor() {
        this._history = [];
        this._lastAction = {};
    }
    get lastAction() {
        return this._lastAction;
    }
    set lastAction(action) {
        this._lastAction = action;
        console.log('lastAction', action);
    }
    clear() {
        this._lastAction = {};
        this._history = [];
    }
    addPageToHistory(newPage) {
        if (this.lastAction.hasOwnProperty('id')) {
            const previousPage = this.lastAction.id;
            let visited = false;
            for (let i = 0; i < this._history.length; i++) {
                if (this._history[i].id == newPage) {
                    this._history.length = i;
                    visited = true;
                    break;
                }
            }
            if (!visited) {
                this._history.push({id: previousPage});
            }
            this.lastAction = {
                id: newPage
            }
            console.log(this._history);
        } else {
            this.lastAction.id = 0;
        }
    }
    addKeyframeToHistory(pageId, assetId, keyFrame) {
        this._history.push({
            id: pageId,
            asset: assetId,
            keyframe: keyFrame
        })
        this.lastAction = {
            id: pageId,
            asset: assetId,
            keyframe: keyFrame
        }
        console.log(this._history);
    }
    getLastAction() {
        // Get last action from history.
        let output = this._history[this._history.length-1];
        if (output.hasOwnProperty('asset')) {
            this._history.pop();
        }
        return output;
    }
}