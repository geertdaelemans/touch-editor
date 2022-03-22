const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Project = new Schema(
    {
        projectName: { type: String, required: true },
        canvasWidth: { type: Number, default: 1920 },
        canvasHeight: { type: Number, default: 1080 },
        transitionSpeed: { type: Number, default: 0.6 },
        transotionAudio: { type: String }
    },
    { timestamps: true }
)

module.exports = mongoose.model('project', Project)