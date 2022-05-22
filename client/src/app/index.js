import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "../style/App.css";

import {
    NavBar,
    ProjectsUpdate,
    UsersUpdate,
} from "../components";
import { ProjectsList, ProjectsCreate, UsersList } from "../pages";
import Login from "../components/login.component";
import Register from "../components/register.component";

import ProtectedRoutes from "../auth/PrivateRoute";

import "bootstrap/dist/css/bootstrap.min.css";

function App() {
    return (
        <Router>
            <NavBar />
            <Routes>
                <Route path="/client/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoutes />}>
                    <Route path="/" element={<ProjectsList />} />
                    <Route path="/client/" element={<ProjectsList />} />
                    <Route path="/client/projects" element={<ProjectsList />} />
                    <Route
                        path="/client/projects/create"
                        element={<ProjectsCreate />}
                    />
                    <Route
                        path="/client/projects/update/:id"
                        element={<ProjectsUpdate />}
                    />
                    <Route path="/client/users" element={<UsersList />} />
                    <Route
                        path="/client/users/register"
                        element={<Register />}
                    />
                    <Route
                        path="/client/users/update/:id"
                        element={<UsersUpdate />}
                    />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
