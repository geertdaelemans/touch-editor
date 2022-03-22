import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { NavBar, ProjectsUpdate } from '../components';
import { ProjectsList, ProjectsCreate} from '../pages';

import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<ProjectsList />} />
        <Route path="/projects/list" element={<ProjectsList />} />
        <Route path="/projects/create" element={<ProjectsCreate />} />
        <Route path="/projects/update/:id" element={<ProjectsUpdate />} />
      </Routes>
    </Router>
  );
}

export default App;