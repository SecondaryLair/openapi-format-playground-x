"use client";

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import MonacoEditorComponent with ssr: false
const MonacoEditorComponent = dynamic(() => import('./MonacoEditorComponent'), {
  ssr: false,
});

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
  trimNewline?: boolean;
  extraSuggestions?: string[];
}

const MonacoEditorWrapper: React.FC<MonacoEditorProps> = ({
  value, 
  onChange, 
  language, 
  height, 
  trimNewline = false,
  extraSuggestions = []
}) => {
  let trimmedValue = value
  if(value && trimNewline) {
    trimmedValue = value.replace(/\n+$/, '');
  }
  return (
    <MonacoEditorComponent 
      value={trimmedValue} 
      onChange={onChange} 
      language={language} 
      height={height}
      extraSuggestions={extraSuggestions}
    />
  );
};

export default MonacoEditorWrapper;
