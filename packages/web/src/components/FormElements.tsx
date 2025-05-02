import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

const Input = ({
  label,
  helperText,
  error,
  fullWidth = false,
  className = "",
  ...props
}: InputProps) => {
  return (
    <div className={`mb-4 ${fullWidth ? "w-full" : ""}`}>
      <label 
        htmlFor={props.id} 
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      
      <input
        className={`
          shadow-sm
          rounded-md
          border-gray-300
          focus:border-primary focus:ring focus:ring-primary/20 focus:ring-opacity-50
          ${error ? "border-red-500 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500" : ""}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      />
      
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

const Select = ({
  label,
  options,
  helperText,
  error,
  fullWidth = false,
  className = "",
  ...props
}: SelectProps) => {
  return (
    <div className={`mb-4 ${fullWidth ? "w-full" : ""}`}>
      <label 
        htmlFor={props.id} 
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      
      <select
        className={`
          rounded-md
          border-gray-300
          focus:border-primary focus:ring focus:ring-primary/20 focus:ring-opacity-50
          ${error ? "border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500" : ""}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export { Input, Select };
