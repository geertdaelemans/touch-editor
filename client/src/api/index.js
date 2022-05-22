import axios from 'axios';

const link = `http://${process.env.REACT_APP_URL}:${process.env.REACT_APP_PORT}/api`;
const api = axios.create({
    baseURL: link
});
// Add a request interceptor
api.interceptors.request.use(function (config) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
        const token = `Bearer ${user.token}`;
        console.log(`Bearer ${user.token}`);
        config.headers.Authorization = token;
    }
    return config;
});

export const createProject = payload => api.post(`/project`, payload);
export const getAllProjects = () => api.get(`/projects`);
export const updateProjectById = (id, payload) => api.put(`/project/${id}`, payload);
export const deleteProjectById = id => api.delete(`/project/${id}`);
export const getProjectById = id => api.get(`/project/${id}`);
export const registerUser = payload => api.post(`/user`, payload);
export const loginUser = payload => api.post(`/user/login`, payload);
export const logoutUser = () => api.post(`/user/logout`);
export const getUsersList = () => api.get(`/users`);
export const deleteUserById = id => api.delete(`/user/${id}`);
export const updateUserById = (id, payload) => api.put(`/user/${id}`, payload);
export const getUserById = id => api.get(`/user/${id}`);
export const usersCleanup = () => api.get(`/users/cleanup`);

const apis = {
    createProject,
    getAllProjects,
    updateProjectById,
    deleteProjectById,
    getProjectById,
    registerUser,
    loginUser,
    logoutUser,
    getUsersList,
    deleteUserById,
    updateUserById,
    getUserById,
    usersCleanup
}

export default apis;