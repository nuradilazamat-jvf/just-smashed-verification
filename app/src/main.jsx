import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./shell/App";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard.jsx";
import Location from "./pages/Location";
import Review from "./pages/Review";
import RestaurantViewer from "./pages/RestaurantViewer.jsx";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "location", element: <Location /> },
      { path: "review", element: <Review /> },
      { path: "restaurant", element: <RestaurantViewer /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
