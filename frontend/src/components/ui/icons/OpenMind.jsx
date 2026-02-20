import React from 'react';

export default function OpenMind({ size = 48, className = '' }) {
  return (
    <img 
      src="https://customer-assets.emergentagent.com/job_161f81bd-5735-4617-8089-a38a02a78c0e/artifacts/g6i8r1r4_872.jpg"
      alt="OpenMind"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
