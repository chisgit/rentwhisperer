import React from "react";

type ButtonProps = {
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  form?: string;
  loading?: boolean;
};

const Button = ({
  variant = "primary",
  size = "medium",
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
  form,
  loading = false,
}: ButtonProps) => {
  // Base classes for all buttons
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  // Size-specific classes
  const sizeClasses = {
    small: "px-3 py-1.5 text-sm",
    medium: "px-4 py-2 text-base",
    large: "px-6 py-3 text-lg",
  };

  // Variant-specific classes
  const variantClasses = {
    primary: "bg-primary hover:bg-secondary text-white focus:ring-primary/50",
    secondary: "bg-accent hover:bg-accent/90 text-white focus:ring-accent/50",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-primary/50",
    text: "text-primary hover:bg-gray-50 focus:ring-primary/50",
  };

  // Disabled classes
  const disabledClasses = (disabled || loading)
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      form={form}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
