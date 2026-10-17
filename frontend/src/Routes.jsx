import { BrowserRouter, Routes, Route } from "react-router-dom";


// Import das telas
import Home from "./pages/homePage";

const AppRotas = () => {

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />}>

                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default AppRotas;