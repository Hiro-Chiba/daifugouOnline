'use client';

interface ToastProps {
  messages: string[];
}

const Toast = ({ messages }: ToastProps) => {
  if (messages.length === 0) {
    return null;
  }
  return (
    <div className="toast-container">
      {messages.map((message) => (
        <div className="toast" key={message}>
          {message}
        </div>
      ))}
    </div>
  );
};

export default Toast;
