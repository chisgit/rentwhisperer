import React, { Fragment, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnClickOutside?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnClickOutside = true,
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Don't render anything if the modal is closed
  if (!isOpen) return null;

  // Handle backdrop clicks
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnClickOutside && e.target === backdropRef.current) {
      onClose();
    }
  };

  // Size classes mapping
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4"
  };

  // Create a portal to render the modal at the document body level
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        ref={backdropRef}
        onClick={handleBackdropClick}
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className={`${sizeClasses[size]} w-full transform overflow-hidden rounded-lg bg-white shadow-xl transition-all`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-medium text-gray-900"
                id="modal-title"
              >
                {title}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// Example of how to use the Modal
export const ModalExample: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <Fragment>
      <Button onClick={openModal}>Open Modal</Button>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title="Example Modal"
        footer={
          <div className="flex justify-end space-x-3">
            <Button variant="text" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => {
              console.log("Action confirmed");
              closeModal();
            }}>
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-gray-600">
          This is an example modal dialog using Tailwind CSS for styling.
          Click outside or the X to close it.
        </p>
      </Modal>
    </Fragment>
  );
};

export default Modal;
