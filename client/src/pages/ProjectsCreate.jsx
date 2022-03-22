import React, { Component } from 'react';
import api from '../api';

import styled from 'styled-components';

const Title = styled.h1.attrs({
    className: 'h1'
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

class ProjectsCreate extends Component {
    constructor(props) {
        super(props);

        this.state = {
            projectName: ''
        }
    }

    handleChangeInputName = async event => {
        const projectName = event.target.value;
        this.setState({ projectName });
    }

    handleCreateProject = () => {
        const { projectName } = this.state;
        const payload = { projectName: projectName };
        api.createProject(payload);
        window.location.href = `/`;
    }    

    render() {
        const { projectName } = this.state;
        return (
            <Wrapper>
                <Title>Voeg project toe</Title>

                <Label>Naam:</Label>
                <InputText
                    type="text"
                    value={projectName}
                    onChange={this.handleChangeInputName}
                />
                <Button onClick={this.handleCreateProject}>Toevoegen</Button>
                <CancelButton href={'/projects/list'}>Annuleer</CancelButton>
            </Wrapper>
        );
    }
}

export default ProjectsCreate;