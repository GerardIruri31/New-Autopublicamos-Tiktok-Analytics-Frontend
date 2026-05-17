import { useContext } from "react";
import { AuthUserContext } from "./AuthUserContext.jsx";

export const useAuthUser = () => useContext(AuthUserContext);
