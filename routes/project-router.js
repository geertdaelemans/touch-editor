const express = require('express');
const router = express.Router();

const ProjectCtrl = require('../controllers/project-ctrl');
const UserCtrl = require('../controllers/user-ctrl');
const AuthCtrl = require('../controllers/auth.js')();

// Project routes
router.get('/projects', AuthCtrl.authenticate(), ProjectCtrl.getProjects);
router.get('/project/:id', AuthCtrl.authenticate(), ProjectCtrl.getProjectById);
router.post('/project', AuthCtrl.authenticate(), ProjectCtrl.createProject);
router.put('/project/:id', AuthCtrl.authenticate(), ProjectCtrl.updateProject);
router.delete('/project/:id', AuthCtrl.authenticate(), ProjectCtrl.deleteProject);

// User routes  
router.get('/users', UserCtrl.getUserList);
router.get('/users/cleanup', UserCtrl.cleanUp);
router.get('/user/check', UserCtrl.loginChecker);
router.get('/user/:id', UserCtrl.getUserById);
router.post('/user', UserCtrl.createUser);
router.post('/user/login', UserCtrl.loginUser);
router.post('/user/logout', UserCtrl.logoutUser);
router.put('/user/:id', UserCtrl.updateUser);
router.delete('/user/:id', UserCtrl.deleteUser);

module.exports = router