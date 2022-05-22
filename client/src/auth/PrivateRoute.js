import { Navigate, Outlet } from "react-router-dom";

const useAuth = () => {
    const user = localStorage.getItem("user");
    if (user) {
        return true;
    } else {
        return false;
    }
};

const ProtectedRoutes = () => {
    const auth = useAuth();
    return auth ? <Outlet /> : <Navigate to="/client/login" />;
};

export default ProtectedRoutes;
