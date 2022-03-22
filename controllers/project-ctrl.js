const Project = require('../models/project-model');
const util = require('util');

addProject = (data) => {
    const projectName = data.projectName;
    const project = new Project();
    project.projectName = projectName;
    project
        .save()
        .then(() => {
            util.log(`Project ${projectName} added to MongoDb.`);
        })
        .catch((error) => {
            util.log(`Project ${projectName} not added due to error ${error.message}`);
        });
}

updateSettings = (projectName, settings) => {
    Project.findOne({ projectName: projectName }, (error, project) => {
        if (error) {
            util.log(`MongoDb Error: ${error.message}.`);
            return;
        }
        project.projectName = settings.projectName;
        project.canvasWidth = settings.canvasWidth;
        project.canvasHeight = settings.canvasHeight;
        project
            .save()
            .then(() => {
                util.log(`MongoDB: Settings ${project.projectName} updated.`);
            })
            .catch(error => {
                util.log(`MongoDb Error: ${error.message}.`);
            });
    });
}

isProjectListed = async (projectName) => {
    return await Project.find({ projectName: projectName }).limit(1).count() > 0;
}

getNameById = async (id) => {
    const project = await Project.findOne({ _id: id }, { _id: 0, projectName: 1 }).clone().catch(err => util.log(`MongoDb Error: ${err.message}`));
    if (project) {
        return project.projectName;
    } else {
        return null;
    }
}

createProject = async (req, res) => {
    const body = req.body;

    if (!body) {
        return res.status(400).json({
            success: false,
            error: 'You must provide a project',
        });
    }

    const project = new Project(body);

    if (!project) {
        return res.status(400).json({ success: false, error: err });
    }

    const ProjectClass = require('../project.js'); // TODO: This is to avoid circular dependency
    const newProject = new ProjectClass();
    await newProject.create(null, body.projectName);
}

updateProject = async (req, res) => {
    const body = req.body;

    if (!body) {
        return res.status(400).json({
            success: false,
            error: 'You must provide a body to update',
        });
    }

    const originalName = await getNameById(req.params.id);
    const ProjectClass = require('../project.js'); // TODO: This is to avoid circular dependency
    const settings = {
        projectName: body.projectName,
        canvasWidth: body.canvasWidth,
        canvasHeight: body.canvasHeight,
        transitionSpeed: 0.5,
        transitionAudio: 0,
        owner: ''
    };
    const updatedProject = new ProjectClass();
    updatedProject.name = originalName;
    await updatedProject.read();
    await updatedProject.changeSettings(settings);
}

deleteProject = async (req, res) => {
    const name = await getNameById(req.params.id);
    const ProjectClass = require('../project.js'); // TODO: This is to avoid circular dependency
    await ProjectClass.delete(name);
    await Project.findOneAndDelete({ _id: req.params.id }, (err, project) => {
        if (err) {
            return res.status(400).json({ success: false, error: err });
        }

        if (!project) {
            return res
                .status(404)
                .json({ success: false, error: `Project not found` });
        }
        return res.status(200).json({ success: true, data: project });
    }).clone().catch(err => console.log(err));
}

getProjectById = async (req, res) => {
    await Project.findOne({ _id: req.params.id }, (err, project) => {
        if (err) {
            return res.status(400).json({ success: false, error: err });
        }

        if (!project) {
            return res
                .status(404)
                .json({ success: false, error: `Project not found` });
        }
        return res.status(200).json({ success: true, data: project });
    }).clone().catch(err => console.log(err));
}

getProjects = async (req, res) => {
    await Project.find({}, (err, projects) => {
        if (err) {
            return res.status(400).json({ success: false, error: err });
        }
        if (!projects.length) {
            return res
                .status(404)
                .json({ success: false, error: `Project not found` });
        }
        return res.status(200).json({ success: true, data: projects });
    }).clone().catch(err => console.log(err));
}

module.exports = {
    addProject,
    isProjectListed,
    updateSettings,
    createProject,
    updateProject,
    deleteProject,
    getProjects,
    getProjectById,
}