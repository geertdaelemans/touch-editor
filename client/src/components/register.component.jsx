import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useForm, isValidEmail, isRequired, isSame } from "./useForm";

const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");
    const initialState = {
        username: '',
        email: '',
        password: '',
        repeatPassword: ''
    };
    
    const validations = [
        ({ username }) => isRequired(username, 5, 25).check || { username: isRequired(username, 5, 25).message },
        ({ email }) => isValidEmail(email).check || { email: isValidEmail(email).message },
        ({ password }) => isRequired(password, 5, 30).check || { password: isRequired(password, 5, 30).message },
        ({ password, repeatPassword }) => isSame(password, repeatPassword) || { repeatPassword: 'Paswoorden komen niet overeen' }
    ]

    const handleLogin = (output) => {
        setMessage("");
        setLoading(true);
        setSuccessful(true);
        const payload = {
            username: output.username,
            email: output.email,
            password: output.password
        }
        api.registerUser(payload).then(
            (response) => {
                setMessage(response.data.message);
                setLoading(false);
                setSuccessful(true);
                navigate("/client/users");
                window.location.reload();
            },
            (error) => {
                const resMessage =
                    (error.response &&
                        error.response.data &&
                        error.response.data.message) ||
                    error.message ||
                    error.toString();
                setLoading(false);
                setSuccessful(false);
                setMessage(resMessage);
            }
        )
    }

    const { values, changeHandler, isValid, errors, touched, submitHandler } = useForm(initialState, validations, handleLogin);

    return (
        <div className="col-md-12">
            <div className="card card-container">
                <form onSubmit={submitHandler} noValidate>
                    {!successful && (
                    <>
                    <div className="form-group">
                        <label>Gerbruikersnaam</label>
                        <input
                            type="text"
                            name="username"
                            className={touched.username && errors.username ? "is-invalid form-control" : "form-control"}
                            value={values.username}
                            onChange={changeHandler} />
                        {touched.username && errors.username && (
                            <span className="invalid-feedback">{errors.username}</span>
                        )}
                    </div>
                    <div className="form-group">
                        <label>E-mail</label>
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
                    <div className="form-group">
                        <label>Herhaal paswoord</label>
                        <input
                            type="password"
                            name="repeatPassword"
                            className={touched.repeatPassword && errors.repeatPassword ? "is-invalid form-control" : "form-control"}
                            value={values.repeatPassword}
                            onChange={changeHandler} />
                        {touched.repeatPassword && errors.repeatPassword && (
                            <span className="invalid-feedback">{errors.repeatPassword}</span>
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
                            <span>Registreer</span>
                        </button>
                    </div>
                    </>
                    )}
                    {message && (
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <div 
                                className={ successful ? "alert alert-success" : "alert alert-danger" } 
                                role="alert">
                                {message}
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default Register;