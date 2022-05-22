import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const Collapse = styled.div.attrs({
    className: 'collpase navbar-collapse',
})``

const List = styled.div.attrs({
    className: 'navbar-nav mr-auto',
})``

const Item = styled.div.attrs({
    className: 'collpase navbar-collapse',
})``

const Links = () => {
    const [loggedIn, setLoggedIn] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("user")) {
            setLoggedIn(true);
        } else {
            setLoggedIn(false);
        }
    }, [setLoggedIn]);

    return (
        <React.Fragment>
            <Collapse>
                <List>
                    {loggedIn && (
                        <>
                            <Item>
                                <Link to="/client/projects" className="nav-link">
                                    Projecten
                                </Link>
                            </Item>
                            <Item>
                                <Link to="/client/users" className="nav-link">
                                    Gebruikers
                                </Link>
                            </Item>
                            <Item>
                                <Link to="/client/login" className="nav-link">
                                    Profiel
                                </Link>
                            </Item>
                        </>
                    )}
                    {!loggedIn && (
                        <Item>
                            <Link to="/client/login" className="nav-link">
                                Login
                            </Link>
                        </Item>
                    )}
                </List>
            </Collapse>
        </React.Fragment>
    );
}

export default Links;