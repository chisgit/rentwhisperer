import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Tenants from "./pages/Tenants";
import Payments from "./pages/Payments";
import Notifications from "./pages/Notifications";
import Layout from "./components/Layout";
import "./App.css";

function App() {
  // Log when component renders
  useEffect(() => {
    console.log("App component loaded");
  }, []);
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </Layout>
  );
}

export default App;
