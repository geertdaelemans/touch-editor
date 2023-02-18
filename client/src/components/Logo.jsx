import React, { Component } from 'react';
import styled from 'styled-components';

import logo from '../vrt-touch-logo-xs.png';

const Wrapper = styled.a.attrs({
    className: 'navbar-brand',
})``

class Logo extends Component {
    render() {
        const link = process.env.REACT_APP_SERVER_URL;
        return (
            <Wrapper href={link}>
                <img src={logo} height="25" alt="VRT Touch" />
            </Wrapper>
        )
    }
}

export default Logo;