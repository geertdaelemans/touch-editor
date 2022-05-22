import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useForm, isRequired } from "./useForm";

const Login = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState("");
    const [loggedIn, setLoggedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const initialState = {
        email: '',
        password: ''
    };
    const validations = [
        ({ email }) => isRequired(email).check || { email: isRequired(email).message },
        ({ password }) => isRequired(password).check || { password: isRequired(password).message }
    ]

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("user"));
        if (user && user.tokenExpires > Date.now()) {
            setLoggedIn(true);
            setUserName(user.username);
        }
    }, [setLoggedIn]);

    const handleLogin = (output) => {
        setMessage("");
        setLoading(true);
        const payload = {
            username: output.email,
            password: output.password
        }
        api.loginUser(payload).then(
            (response) => {
                setMessage(response.data.message);
                setLoading(false);
                if (response.data.token) {
                    console.log(response.data);
                    localStorage.setItem("user", JSON.stringify(response.data));
                }
                navigate("/client");
                navigate(0);
            },
            (error) => {
                const resMessage =
                    (error.response &&
                        error.response.data &&
                        error.response.data.message) ||
                    error.message ||
                    error.toString();
                setLoading(false);
                setMessage(resMessage);
            }
        )
    }

    const handleLogout = () => {
        localStorage.removeItem("user");
        values.email = initialState.email;
        values.password = initialState.password;
        setMessage("");
        setLoggedIn(false);
        navigate(0);
    }

    const { values, changeHandler, isValid, errors, touched, submitHandler } = useForm(initialState, validations, handleLogin);

    return (
        <div className="col-md-12">
            <div className="card card-container">
                <img
                    src="//ssl.gstatic.com/accounts/ui/avatar_2x.png"
                    alt="profile-img"
                    className="profile-img-card"
                />
                {!loggedIn && (
                    <form onSubmit={submitHandler} noValidate>
                        <div className="form-group">
                            <label>E-mail of gebruikersnaam</label>
                            <input
                                type="email"
                                name="email"
                                className={touched.email && errors.email ? "is-invalid form-control" : "form-control"}
                                value={values.email}
                                onChange={changeHandler} />
                            {touched.email && errors.email && (
                                <span className="invalid-feedback">{errors.email}</span>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Paswoord</label>
                            <input
                                type="password"
                                name="password"
                                className={touched.password && errors.password ? "is-invalid form-control" : "form-control"}
                                value={values.password}
                                onChange={changeHandler} />
                            {touched.password && errors.password && (
                                <span className="invalid-feedback">{errors.password}</span>
                            )}
                        </div>
                        <div className="form-group text-center" style={{ marginTop: '1rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary btn-block"
                                disabled={!isValid}>
                                {loading && (
                                    <span className="spinner-border spinner-border-sm" style={{ marginRight: '.5rem' }}></span>
                                )}
                                <span>Log in</span>
                            </button>
                        </div>
                        {message && (
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <div className="alert alert-danger" role="alert">
                                    {message}
                                </div>
                            </div>
                        )}
                    </form>
                )}
                {loggedIn && (
                    <div className="form-group text-center" style={{ marginTop: '1rem' }}>
                        <div>Ingelogd als<br />{userName}</div>
                        <button
                            onClick={handleLogout}
                            className="btn btn-primary btn-block" >
                            <span>Log uit</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;