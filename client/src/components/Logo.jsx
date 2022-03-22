import React, { Component } from 'react';
import styled from 'styled-components';

import logo from '../vrt-touch-logo-xs.png';

const Wrapper = styled.a.attrs({
    className: 'navbar-brand',
})``

class Logo extends Component {
    render() {
        return (
            <Wrapper href="https://localhost:3000">
                <img src={logo} height="25" alt="sambarros.com" />
            </Wrapper>
        )
    }
}

export default Logo;