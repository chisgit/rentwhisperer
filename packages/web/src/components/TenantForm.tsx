import React, { useEffect, useState } from "react";
import { Input, Select } from "./FormElements";
import Button from "./Button";
import Card from "./Card";
import { tenantsApi } from "../services/api.service";

// Define the Tenant interface for type-checking
interface Tenant {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  unit_id: number | string;
}

// Define Unit interface
interface Unit {
  id: number;
  unit_number: string;
  property_name: string;
  value: string;
  label: string;
}

interface TenantFormProps {
  tenant?: Tenant;
  onSave: (formData: Tenant) => void;
  onCancel: () => void;
  loading?: boolean;
}

const TenantForm: React.FC<TenantFormProps> = ({
  tenant,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<Tenant>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    unit_id: "",
  });

  const [units, setUnits] = useState<{ value: string, label: string }[]>(
    [
      { value: "", label: "Loading units..." }
    ]
  );

  const [unitsLoading, setUnitsLoading] = useState<boolean>(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  // Fetch units from the API
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setUnitsLoading(true);
        const unitsData = await tenantsApi.getAllUnits() as Unit[];

        // Convert to format needed for Select component
        const unitOptions = [
          { value: "", label: "Select a unit" },
          ...unitsData.map(unit => ({
            value: unit.id.toString(),
            label: unit.label
          }))
        ];

        setUnits(unitOptions);
        setUnitsError(null);
      } catch (err: any) {
        console.error("Error fetching units:", err);
        setUnitsError("Failed to load units");
        // Fallback options if API fails
        setUnits([
          { value: "", label: "Failed to load units" },
          { value: "1", label: "Unit 101" },
        ]);
      } finally {
        setUnitsLoading(false);
      }
    };

    fetchUnits();
  }, []);

  // When tenant prop changes, update the form data
  useEffect(() => {
    if (tenant) {
      setFormData({
        ...tenant,
        // Convert unit_id to string for the select input if needed
        unit_id: tenant.unit_id.toString()
      });
    }
  }, [tenant]);

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

    // Convert unit_id back to a number before saving
    const dataToSave = {
      ...formData,
      unit_id: formData.unit_id ? Number(formData.unit_id) : 0
    };

    // Call the onSave prop to handle saving the data
    onSave(dataToSave);
  };

  const isEditMode = Boolean(tenant?.id);
  const cardTitle = isEditMode ? "Edit Tenant" : "Add New Tenant";

  return (
    <Card
      title={cardTitle}
      className="max-w-2xl mx-auto"
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="text" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            type="submit"
            form="tenant-form"
            loading={loading}
            disabled={loading}
          >
            {isEditMode ? "Update Tenant" : "Save Tenant"}
          </Button>
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
            disabled={loading}
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
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label="Email"
            id="email"
            name="email"
            type="email"
            value={formData.email || ""}
            onChange={handleChange}
            placeholder="john.smith@example.com"
            fullWidth
            required
            disabled={loading}
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
            disabled={loading}
          />
        </div>

        <div className="mt-4">
          <Select
            label="Assigned Unit"
            id="unit_id"
            name="unit_id"
            value={formData.unit_id.toString()}
            onChange={handleChange}
            options={units}
            fullWidth
            required
            disabled={loading || unitsLoading}
            helperText={unitsLoading ? "Loading units..." : (unitsError || undefined)}
            error={unitsError || undefined}
          />
          {unitsLoading && (
            <p className="mt-2 text-sm text-gray-500">Loading available units...</p>
          )}
        </div>
      </form>
    </Card>
  );
};

export default TenantForm;
