import React, { Component } from 'react';
import api from '../api';

import styled from 'styled-components';

const Title = styled.h1.attrs({
    className: 'h1',
})``

const Wrapper = styled.div.attrs({
    className: 'form-group',
})`
    margin: 0 30px;
`

const Label = styled.label`
    margin: 5px;
`

const InputText = styled.input.attrs({
    className: 'form-control',
})`
    margin: 5px;
`

const Button = styled.button.attrs({
    className: `btn btn-primary`,
})`
    margin: 15px 15px 15px 5px;
`

const CancelButton = styled.a.attrs({
    className: `btn btn-danger`,
})`
    margin: 15px 15px 15px 5px;
`

class ProjectsUpdate extends Component {

    constructor(props) {
        super(props);
        this.state = {
            id: props.id,
            projectName: '',
            canvasWidth: 1920,
            canvasHeight: 1080
        }
    }

    handleChangeInputName = async event => {
        const projectName = event.target.value;
        this.setState({ projectName });
    }

    handleChangeInputCanvasWidth = async event => {
        const canvasWidth = event.target.value;
        this.setState({ canvasWidth });
    }

    handleChangeInputCanvasHeight = async event => {
        const canvasHeight = event.target.value;
        this.setState({ canvasHeight });
    }

    handleUpdateProject = () => {
        const { id, projectName, canvasWidth, canvasHeight } = this.state;
        const payload = { projectName, canvasWidth, canvasHeight }
        api.updateProjectById(id, payload);
        window.location.href = `/`;
    }

    componentDidMount = async () => {
        const { id } = this.state;
        const project = await api.getProjectById(id);

        this.setState({
            projectName: project.data.data.projectName,
            canvasWidth: project.data.data.canvasWidth,
            canvasHeight: project.data.data.canvasHeight 
        });
    }

    render() {
        const { projectName, canvasWidth, canvasHeight } = this.state;
        return (
            <Wrapper>
                <Title>Wijzig project:</Title>
                <Label>Naam:</Label>
                <InputText
                    type="text"
                    value={projectName}
                    onChange={this.handleChangeInputName}
                />
                <Label>Canvasbreedte:</Label>
                <InputText
                    type="text"
                    value={canvasWidth}
                    onChange={this.handleChangeInputCanvasWidth}
                />
                <Label>Canvashoogte:</Label>
                <InputText
                    type="text"
                    value={canvasHeight}
                    onChange={this.handleChangeInputCanvasHeight}
                />
                <Button onClick={this.handleUpdateProject}>Bewaar</Button>
                <CancelButton href={'/projects/list'}>Annuleer</CancelButton>
            </Wrapper>
        );
    }
}

export default ProjectsUpdate;