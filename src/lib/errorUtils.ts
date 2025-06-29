
import { toast } from "sonner";

/**
 * Displays a friendly error message to the user and logs the detailed error
 */
export const handleError = (error: unknown, friendlyMessage?: string): void => {
  console.error('Error occurred:', error);
  
  const displayMessage = friendlyMessage || getDefaultErrorMessage(error);
  
  toast.error('Error', {
    description: displayMessage,
    duration: 5000,
  });
};

/**
 * Gets a user-friendly error message from an error object
 */
export const getDefaultErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('network')) {
      return 'Network connection error. Please check your internet connection.';
    }
    if (error.message.includes('permission') || error.message.includes('denied')) {
      return 'Permission denied. You may not have access to this feature.';
    }
    // Only use error.message if it's reasonably short and readable
    if (error.message.length < 100) {
      return error.message;
    }
  }
  
  // Default fallback message
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Wraps an async function with error handling
 * @param fn The async function to wrap
 * @param errorMessage Optional friendly error message to display if the function throws
 * @returns The result of the function, or undefined if an error occurred
 */
export const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    handleError(error, errorMessage);
    return undefined;
  }
};

/**
 * Creates a debounced version of a function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
