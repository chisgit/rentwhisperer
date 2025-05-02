import React from "react";
import { Input, Select } from "./FormElements";
import Button from "./Button";
import Card from "./Card";

const TenantForm = () => {
  const [formData, setFormData] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    unit_id: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted with data:", formData);
    // Here we would normally call the API to create/update the tenant
  };

  // Mock data for units
  const units = [
    { value: "", label: "Select a unit" },
    { value: "101", label: "101 - Sunrise Apartments" },
    { value: "102", label: "202 - Sunrise Apartments" },
    { value: "103", label: "303 - Oakwood Residences" },
    { value: "104", label: "404 - Oakwood Residences" },
  ];

  return (
    <Card
      title="Tenant Information"
      className="max-w-2xl mx-auto"
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="text">Cancel</Button>
          <Button type="submit" form="tenant-form">Save Tenant</Button>
        </div>
      }
    >
      <form id="tenant-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            placeholder="John"
            fullWidth
            required
          />

          <Input
            label="Last Name"
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            placeholder="Smith"
            fullWidth
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label="Email"
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="john.smith@example.com"
            fullWidth
            required
          />

          <Input
            label="Phone"
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (416) 555-1234"
            helperText="Include country code, e.g. +1 for Canada/US"
            fullWidth
            required
          />
        </div>

        <div className="mt-4">
          <Select
            label="Assigned Unit"
            id="unit_id"
            name="unit_id"
            value={formData.unit_id}
            onChange={handleChange}
            options={units}
            fullWidth
            required
          />
        </div>
      </form>
    </Card>
  );
};

export default TenantForm;
