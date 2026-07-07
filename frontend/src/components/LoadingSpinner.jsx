import React from 'react';

const LoadingSpinner = ({ size = 'medium', color = 'accent', inline = false }) => {
  return (
    <div className={`spinner-container ${inline ? 'inline' : ''}`}>
      <div className={`spinner ${size} ${color}`}></div>
    </div>
  );
};

export default LoadingSpinner;
