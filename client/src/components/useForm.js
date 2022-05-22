// Inspiration: https://dimitr.im/form-validation-react-hooks

import { useState } from "react";

export function isValidEmail(value) {
    if (value && value.length > 0) {
        const regExp = RegExp(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/);
        if (regExp.test(value)) {
            return {
                check: true,
                message: "Geldig e-mailadres"
            }
        } else {
            return {
                check: false,
                message: "Ongeldig e-mailadres"
            }
        }
    } else {
        return {
            check: false,
            message: "E-mailadres is verplicht"
        }        
    }
}

export function isRequired(value, min = null, max = null) {
    if (value != null && value.trim().length > 0) {
        if (min && value.trim().length < min) {
            return {
                check: false,
                message: `Minimum ${min} karakters lang`
            }          
        }
        if (max && value.trim().length > max) {
            return {
                check: false,
                message: `Maximum ${max} karakters lang`
            }          
        }
        return {
            check: true,
            message: `Geldige invoer`
        } 
    } else {
        return {
            check: false,
            message: `Verplicht veld`
        }         
    };
}

export function isSame(value1, value2) {
    return value1 === value2;
}

function validate(validations, values) {
    const errors = validations
      .map(validation => validation(values))
      .filter(validation => typeof validation === 'object');
    return {isValid: errors.length === 0, errors: errors.reduce((errors, error) => ({...errors, ...error}), {})};
}

export function useForm(initialState = {}, validations = [], onSubmit = () => {}) {
    const {isValid: initialIsValid, errors: initialErrors} = validate(validations, initialState);
    const [values, setValues] = useState(initialState);
    const [errors, setErrors] = useState(initialErrors);
    const [isValid, setValid] = useState(initialIsValid);
    const [touched, setTouched] = useState({});
    const changeHandler = event =>{
        const newValues = {...values, [event.target.name]: event.target.value};
        const {isValid, errors} = validate(validations, newValues);
        setValues(newValues);
        setValid(isValid);
        setErrors(errors);
        setTouched({...touched, [event.target.name]: true});
    }
    const submitHandler = event => {
        event.preventDefault();
        onSubmit(values);
    }
    return {values, changeHandler, isValid, errors, touched, submitHandler};
}

const exporting = {
    useForm, 
    isValidEmail, 
    isSame, 
    isRequired
}

export default exporting;