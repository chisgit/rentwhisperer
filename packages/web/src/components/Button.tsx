import React from "react";

type ButtonProps = {
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
};

const Button = ({
  variant = "primary",
  size = "medium",
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
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
  const disabledClasses = disabled 
    ? "opacity-50 cursor-not-allowed" 
    : "cursor-pointer";
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
