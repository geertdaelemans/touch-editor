import React from 'react';
import { useParams } from "react-router-dom";

import { ProjectsUpdate } from '../pages';

function Example() {

    const { id } = useParams();
    console.log(id);

    return (
        <>
            <ProjectsUpdate id={id} />
        </>
    );
}

export default Example;