import { useState, useEffect } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import api from '../api';

import { Title, Wrapper, Label, InputText, Button, CancelButton } from "../style";

const UsersUpdate = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loaded, setLoaded] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roles, setRoles] = useState([]);

    const handleChangeUsername = event => {
        setUsername(event.target.value);
    }

    const handleChangeEmail = event => {
        setEmail(event.target.value);
    }

    const handleChangeRoles = event => {
        const newRoles = event.target.value.split(',');
        setRoles(newRoles);
    }
   
    const handleChangePassword = event => {
        setPassword(event.target.value);
    }

    const handleUpdateUser = async () => {
        const payload = { username, email, roles };
        if (password.length > 6) {
            payload.password = password;
        }
        await api.updateUserById(id, payload);
        navigate(`/client/users`);
    }

    const fetchData = async () => {
        if (!loaded) {
            const user = await api.getUserById(id);
            setUsername(user.data.data.username);
            setEmail(user.data.data.email);
            setRoles(user.data.data.roles);
            setLoaded(true);
        }
    }

    useEffect(() => {
        fetchData();
    });

    return (
        <Wrapper>
            <Title>Wijzig gebruiker:</Title>
            <Label>Gebruikersnaam:</Label>
            <InputText
                type="text"
                value={username}
                onChange={handleChangeUsername}
            />
            <Label>E-mail</Label>
            <InputText
                type="text"
                value={email}
                onChange={handleChangeEmail}
            />
            <Label>Rollen</Label>
            <InputText
                type="text"
                value={roles}
                onChange={handleChangeRoles}
            />
            <Label>Paswoord</Label>
            <InputText
                type="password"
                value={password}
                onChange={handleChangePassword}
            />
            {/* <Label>Herhaal paswoord</Label>
            <InputText
                type="password"
                name="repeatedpassword"
            /> */}
            <Button onClick={handleUpdateUser}>Bewaar</Button>
            <CancelButton href={'/client/users'}>Annuleer</CancelButton>
        </Wrapper>
    );
}

export default UsersUpdate;