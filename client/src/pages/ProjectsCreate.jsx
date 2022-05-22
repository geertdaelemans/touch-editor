import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

import { Title, Wrapper, Label, InputText, Button, CancelButton } from "../style";

const ProjectsCreate = () => {
    const navigate = useNavigate();
    const [projectName, setProjectName] = useState('');

    const handleChangeInputName = async event => {
        setProjectName(event.target.value);
    }

    const handleCreateProject = () => {
        const payload = { projectName: projectName };
        api.createProject(payload);
        navigate("/client/projects");
    }    

    return (
        <Wrapper>
            <Title>Voeg project toe</Title>

            <Label>Naam:</Label>
            <InputText
                type="text"
                value={projectName}
                onChange={handleChangeInputName}
            />
            <Button onClick={handleCreateProject}>Toevoegen</Button>
            <CancelButton href={'/client/projects'}>Annuleer</CancelButton>
        </Wrapper>
    );
}

export default ProjectsCreate;