import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import Table from "../components/Table";

import { Wrapper, Update, Delete, Button, ErrorMessage } from "../style";

const UsersList = () => {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [users, setUsers] = useState([]);

    const onUsersCleanup = async () => {
        const response = await api.usersCleanup();
        if (response.data && response.data.users) {
            if (response.data.users.length === 0) {
                alert("Er waren geen aanpassingen nodig")
            } else {
                fetchData();
                setErrorMessage(`Aangepaste gebruikers: ${response.data.users.map( name => {return name})}`);
            }
        }
    }

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        await api
            .getUsersList()
            .then((users) => {
                setUsers(users.data.data);
                setIsLoading(false);
            })
            .catch((error) => {
                setErrorMessage(error.message);
            });
    }, []);

    const Roles = (data) => {
        let roleString = "";
        for (let i in data.data) {
            roleString = roleString + data.data[i] + " ";
        }

        return <>{roleString}</>;
    };

    const UpdateUser = (data) => {
        const updateUser = (event) => {
            event.preventDefault();
            navigate(`/client/users/update/${data.id}`);
        };

        return <Update onClick={updateUser}>Aanpassen</Update>;
    };

    const DeleteUser = (data) => {
        const deleteUser = async (event) => {
            event.preventDefault();
            if (
                window.confirm(
                    `Wil je de gebruiker ${data.name} permanent verwijderen?`
                )
            ) {
                await api
                    .deleteUserById(data.id)
                    .then(() => {
                        fetchData();
                    })
                    .catch((error) => {
                        fetchData();
                        alert(error.message);
                    });
            }
        };

        return <Delete onClick={deleteUser}>Verwijder</Delete>;
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const columns = [
        {
            Header: "Gebruikersnaam",
            accessor: "username",
            filterable: true,
        },
        {
            Header: "E-mail",
            accessor: "email",
            filterable: true,
        },
        {
            Header: "Rollen",
            filterable: true,
            Cell: function (props) {
                return <Roles data={props.row.original.roles} />;
            },
        },
        {
            Header: "",
            accessor: "update",
            Cell: function (props) {
                return (
                    <span>
                        <UpdateUser id={props.row.original.id} />
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
                        <DeleteUser
                            id={props.row.original.id}
                            name={props.row.original.username}
                        />
                    </span>
                );
            },
        },
    ];

    return (
        <Wrapper>
            {errorMessage && (
                <ErrorMessage>{errorMessage}</ErrorMessage>
            )}
            {!isLoading && users.length && (
                <Table data={users} columns={columns} isLoading={isLoading} />
            )}
            {!isLoading && (
                <>
                    <Link to="/client/users/register" className="nav-link">
                        <Button>
                            Voeg gebruiker toe
                        </Button>
                    </Link>
                    <Button onClick={onUsersCleanup}>Vernieuw databank</Button>
                </>
            )}
        </Wrapper>
    );
};

export default UsersList;
