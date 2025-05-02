import React from "react";
import Button from "./Button";

type CardProps = {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  titleRightElement?: React.ReactNode;
};

const Card = ({
  title,
  children,
  footer,
  className = "",
  titleRightElement,
}: CardProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        {titleRightElement && <div>{titleRightElement}</div>}
      </div>
      
      <div className="px-6 py-4">
        {children}
      </div>
      
      {footer && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
};

// Example usage of the card component with a sample action button
export const CardExample = () => {
  return (
    <Card 
      title="Sample Card" 
      titleRightElement={<Button variant="outline" size="small">Action</Button>}
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="text">Cancel</Button>
          <Button>Save</Button>
        </div>
      }
      className="max-w-md"
    >
      <p className="text-gray-600">
        This is a sample card component using Tailwind CSS for styling.
        It demonstrates how to create reusable components with Tailwind.
      </p>
    </Card>
  );
};

export default Card;
