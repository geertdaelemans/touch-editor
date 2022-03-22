import React, { Component } from 'react';
import api from '../api';
import Table from '../components/Table';
import styled from 'styled-components';


const Wrapper = styled.div`
    padding: 0 40px 40px 40px;
`
const Update = styled.div`
    color: #ef9b0f;
    cursor: pointer;
`
const Delete = styled.div`
    color: #ff0000;
    cursor: pointer;
`

class UpdateProject extends Component {
    updateProject = event => {
        event.preventDefault();
        window.location.href = `/projects/update/${this.props.id}`;
    }

    render() {
        return <Update onClick={this.updateProject}>Aanpassen</Update>
    }
}

class DeleteProject extends Component {
    deleteProject = event => {
        event.preventDefault();
        if (
            window.confirm(
                `Do you want to delete the movie ${this.props.id} permanently?`
            )
        ) {
            api.deleteProjectById(this.props.id);
            window.location.reload();
        }
    }

    render() {
        return <Delete onClick={this.deleteProject}>Verwijder</Delete>
    }
}


class ProjectsList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            projects: [],
            isLoading: false
        }
    }

    componentDidMount = async () => {
        this.setState({ isLoading: true });
        await api.getAllProjects().then(projects => {
            this.setState({
                projects: projects.data.data,
                isLoading: false
            });
        });
    }

    render() {
        const { projects, isLoading } = this.state;
    
        const columns = [
            {
                Header: 'Titel',
                accessor: 'projectName',
                filterable: true
            }, 
            {
                Header: '',
                accessor: 'update',
                Cell: function(props) {
                    return (
                        <span>
                            <UpdateProject id={props.row.original._id} />
                        </span>
                    );
                }
            },
            {
                Header: '',
                accessor: 'delete',
                Cell: function(props) {
                    return (
                        <span>
                            <DeleteProject id={props.row.original._id} />
                        </span>
                    );
                }
            }            
        ];

        let showTable = true
        if (!projects.length) {
            showTable = false
        }

        return (
            <Wrapper>
                {showTable && (
                    <Table
                        data={projects}
                        columns={columns}
                        isLoading={isLoading}
                    />
                )}
            </Wrapper>
        );
    }
}

export default ProjectsList;