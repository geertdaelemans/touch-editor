import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import Table from "../components/Table";

import { Wrapper, Update, Delete } from "../style";

const ProjectsList = () => {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [projects, setProjects] = useState([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        await api
            .getAllProjects()
            .then((projects) => {
                setProjects(projects.data.data);
                setIsLoading(false);
            })
            .catch((error) => {
                setErrorMessage(error.message);
            });
    }, []);

    const UpdateProject = (data) => {
        const updateProject = (event) => {
            event.preventDefault();
            navigate(`/client/projects/update/${data.id}`);
        };

        return <Update onClick={updateProject}>Aanpassen</Update>;
    };

    const DeleteProject = (data) => {
        const deleteProject = async (event) => {
            event.preventDefault();
            if (
                window.confirm(
                    `Wil je het project ${data.name} permanent verwijderen?`
                )
            ) {
                await api
                    .deleteProjectById(data.id)
                    .then(() => {
                        fetchData();
                    })
                    .catch((error) => {
                        fetchData();
                        alert(error.message);
                    });
            }
        };

        return <Delete onClick={deleteProject}>Verwijder</Delete>;
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const columns = [
        {
            Header: "Titel",
            accessor: "projectName",
            filterable: true,
        },
        {
            Header: "",
            accessor: "update",
            Cell: function (props) {
                return (
                    <span>
                        <UpdateProject id={props.row.original._id} />
                    </span>
                );
            },
        },
        {
            Header: "",
            accessor: "delete",
            Cell: function (props) {
                return (
                    <span>
                        <DeleteProject
                            id={props.row.original._id}
                            name={props.row.original.projectName}
                        />
                    </span>
                );
            },
        },
    ];

    return (
        <Wrapper>
            {errorMessage && (
                <div className="alert alert-danger">{errorMessage}</div>
            )}
            {!isLoading && projects.length && (
                <Table
                    data={projects}
                    columns={columns}
                    isLoading={isLoading}
                />
            )}
            {!isLoading && (
                <Link to="/client/projects/create" className="nav-link">
                    <button className="btn btn-primary btn-block">
                        Maak nieuw project aan
                    </button>
                </Link>
            )}
        </Wrapper>
    );
};

export default ProjectsList;
