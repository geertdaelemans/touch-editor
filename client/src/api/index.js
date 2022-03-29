import axios from 'axios';

const link = `http://${process.env.REACT_APP_URL}:${process.env.REACT_APP_API_PORT}/api`;
const api = axios.create({
    baseURL: link
});

export const createProject = payload => api.post(`/project`, payload);
export const getAllProjects = () => api.get(`/projects`);
export const updateProjectById = (id, payload) => api.put(`/project/${id}`, payload);
export const deleteProjectById = id => api.delete(`/project/${id}`);
export const getProjectById = id => api.get(`/project/${id}`);

const apis = {
    createProject,
    getAllProjects,
    updateProjectById,
    deleteProjectById,
    getProjectById
}

export default apis;