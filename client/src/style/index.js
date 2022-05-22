import styled from "styled-components";

export const Wrapper = styled.div.attrs({
    className: 'form-group',
})`
    padding: 20px 40px 40px 40px;    
    margin: 0 30px;
`

export const Update = styled.div`
    color: #ef9b0f;
    cursor: pointer;
`;
export const Delete = styled.div`
    color: #ff0000;
    cursor: pointer;
`;

export const Title = styled.h1.attrs({
    className: 'h1',
})``

export const Label = styled.label`
    margin: 5px;
`

export const InputText = styled.input.attrs({
    className: 'form-control',
})`
    margin: 5px;
`

export const Button = styled.button.attrs({
    className: `btn btn-primary`,
})`
    margin: 15px 15px 15px 5px;
`

export const CancelButton = styled.a.attrs({
    className: `btn btn-danger`,
})`
    margin: 15px 15px 15px 5px;
`
export const Text = styled.h3.attrs({
    className: 'h3',
})``

export const ErrorMessage = styled.div.attrs({
    className: `alert alert-danger`,
})`
    margin: 15px 15px 15px 5px;
`