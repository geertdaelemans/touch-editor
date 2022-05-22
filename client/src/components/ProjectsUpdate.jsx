import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

import styled from "styled-components";

const Title = styled.h1.attrs({
    className: "h1",
})``;

const Wrapper = styled.div.attrs({
    className: "form-group",
})`
    margin: 0 30px;
`;

const Label = styled.label`
    margin: 5px;
`;

const InputText = styled.input.attrs({
    className: "form-control",
})`
    margin: 5px;
`;

const Button = styled.button.attrs({
    className: `btn btn-primary`,
})`
    margin: 15px 15px 15px 5px;
`;

const CancelButton = styled.a.attrs({
    className: `btn btn-danger`,
})`
    margin: 15px 15px 15px 5px;
`;

const ProjectsUpdate = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loaded, setLoaded] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [canvasWidth, setCanvasWidth] = useState(1920);
    const [canvasHeight, setCanvasHeight] = useState(1080);

    const handleChangeInputName = (event) => {
        setProjectName(event.target.value);
    };

    const handleChangeInputCanvasWidth = (event) => {
        setCanvasWidth(event.target.value);
    };

    const handleChangeInputCanvasHeight = (event) => {
        setCanvasHeight(event.target.value);
    };

    const handleUpdateProject = () => {
        const payload = { projectName, canvasWidth, canvasHeight };
        api.updateProjectById(id, payload).then(() => {
            navigate("/client/projects");
        });
    };

    const fetchData = async () => {
        if (!loaded) {
            const project = await api.getProjectById(id);
            setProjectName(project.data.data.projectName);
            setCanvasWidth(project.data.data.canvasWidth);
            setCanvasHeight(project.data.data.canvasHeight);
            setLoaded(true);
        }
    };

    useEffect(() => {
        fetchData(id);
    });

    return (
        <Wrapper>
            <Title>Wijzig project:</Title>
            <Label>Naam:</Label>
            <InputText
                type="text"
                value={projectName}
                onChange={handleChangeInputName}
            />
            <Label>Canvasbreedte:</Label>
            <InputText
                type="text"
                value={canvasWidth}
                onChange={handleChangeInputCanvasWidth}
            />
            <Label>Canvashoogte:</Label>
            <InputText
                type="text"
                value={canvasHeight}
                onChange={handleChangeInputCanvasHeight}
            />
            <Button onClick={handleUpdateProject}>Bewaar</Button>
            <CancelButton href={"/client/projects"}>Annuleer</CancelButton>
        </Wrapper>
    );
};

export default ProjectsUpdate;
