import React, { useState, useEffect, useRef, ReactNode } from "react";
import { analyzeCurrentSegment, categorizeAndSortSuggestions } from "@/utils/jsonPathUtils";

interface JSONPathAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  debounceTime?: number;
  compact?: boolean;
}

const JSONPathAutocomplete: React.FC<JSONPathAutocompleteProps> = ({
  value,
  onChange,
  suggestions,
  placeholder = "",
  className = "",
  debounceTime = 500,
  compact = true
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const debouncedChangeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter suggestions when input value changes
  useEffect(() => {
    const filterSuggestions = () => {
      if (!inputValue) {
        setFilteredSuggestions([]);
        return;
      }

      // Use the path analysis to get more accurate suggestions
      const analysis = analyzeCurrentSegment(inputValue, cursorPosition);

      // Filter and sort suggestions using our high-performance algorithm
      const filtered = categorizeAndSortSuggestions(suggestions, inputValue, cursorPosition);

      // Limit to a reasonable number to avoid performance issues
      const limitedResults = filtered.slice(0, 100);

      setFilteredSuggestions(limitedResults);

      // Auto-highlight first suggestion for tab completion
      setHighlightedIndex(limitedResults.length > 0 ? 0 : -1);
    };

    filterSuggestions();
  }, [inputValue, suggestions, cursorPosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Store cursor position
    setCursorPosition(e.target.selectionStart || 0);

    // Show suggestions
    setShowSuggestions(true);

    // Debounce the change event to avoid too many re-renders
    if (debouncedChangeTimeout.current) {
      clearTimeout(debouncedChangeTimeout.current);
    }

    debouncedChangeTimeout.current = setTimeout(() => {
      onChange(newValue);
    }, debounceTime);
  };

  const handleSelect = (suggestion: string) => {
    // Get analysis of the current path segment
    const analysis = analyzeCurrentSegment(inputValue, cursorPosition);

    // Format the suggestion based on the current context
    let formattedSuggestion = suggestion;
    let newCursorPosition: number;
    let newInputValue = inputValue; // Initialize with current value

    // Handle different insertion scenarios
    if (analysis.isTypingProperty) {
      // Replace the current property being typed
      newInputValue =
        inputValue.substring(0, analysis.currentSegmentStart) +
        suggestion +
        inputValue.substring(cursorPosition);

      setInputValue(newInputValue);
      newCursorPosition = analysis.currentSegmentStart + suggestion.length;
    }
    else if (analysis.isInBrackets) {
      // Replace content in brackets
      let insertText = suggestion;

      // Check if we need to add quotes
      if (!suggestion.startsWith("'") &&
          (suggestion.includes(' ') || suggestion.includes('-') || suggestion.includes('/'))) {
        insertText = `'${suggestion}'`;
      }

      newInputValue =
        inputValue.substring(0, analysis.currentSegmentStart) +
        insertText +
        inputValue.substring(cursorPosition);

      setInputValue(newInputValue);
      newCursorPosition = analysis.currentSegmentStart + insertText.length;
    }
    else {
      // For root or other contexts, try to intelligently merge

      // Special case: If it's a full path suggestion, replace everything
      if (suggestion.startsWith('$')) {
        setInputValue(suggestion);
        newCursorPosition = suggestion.length;
      }
      // Special case: Starting with $ but selected a dot-prefixed item
      else if (inputValue === '$' && suggestion.startsWith('.')) {
        setInputValue(inputValue + suggestion);
        newCursorPosition = inputValue.length + suggestion.length;
      }
      // Default case: Replace after cursor
      else {
        newInputValue =
          inputValue.substring(0, cursorPosition) +
          suggestion +
          inputValue.substring(cursorPosition);

        setInputValue(newInputValue);
        newCursorPosition = cursorPosition + suggestion.length;
      }
    }

    // Apply the change with the new value
    onChange(newInputValue);
    setShowSuggestions(false);

    // Set cursor position after the update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        setCursorPosition(newCursorPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Don't handle special keys if suggestions aren't shown or no suggestions available
    if (!showSuggestions || filteredSuggestions.length === 0) {
      // Exception for Tab key - show suggestions
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        setShowSuggestions(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;

      case 'Enter':
      case 'Tab': // Add Tab key for selection
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(filteredSuggestions[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;

      default:
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delayed hide to allow clicking on suggestions
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  // Ensure proper scroll position in suggestions list
  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlighted = suggestionsRef.current.children[highlightedIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Render a suggestion with highlighted parts
  const renderSuggestion = (suggestion: string, currentPath: string, cursorPos: number): ReactNode => {
    const analysis = analyzeCurrentSegment(currentPath, cursorPos);
    const isDirectContinuation =
      analysis.parentPath &&
      suggestion.startsWith(analysis.parentPath) &&
      suggestion.length > analysis.parentPath.length;

    if (isDirectContinuation && analysis.parentPath) {
      // Extract just the next segment for cleaner display
      const parentPathLength = analysis.parentPath.length;
      let nextSegmentEnd = suggestion.indexOf('.', parentPathLength + 1);
      if (nextSegmentEnd === -1) nextSegmentEnd = suggestion.indexOf('[', parentPathLength);
      if (nextSegmentEnd === -1) nextSegmentEnd = suggestion.length;

      // Show visual indication of what will be inserted
      return (
        <span>
          <span className="opacity-50">{suggestion.substring(0, parentPathLength)}</span>
          <span className="font-medium text-blue-600 dark:text-blue-300">{suggestion.substring(parentPathLength, nextSegmentEnd)}</span>
          {nextSegmentEnd < suggestion.length && (
            <span className="opacity-30">{suggestion.substring(nextSegmentEnd)}</span>
          )}
        </span>
      );
    }

    return suggestion;
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        onBlur={handleBlur}
        onClick={(e) => {
          setCursorPosition(e.currentTarget.selectionStart || 0);
          setShowSuggestions(true);
        }}
        onSelect={(e) => {
          setCursorPosition(e.currentTarget.selectionStart || 0);
        }}
        className={`w-full p-2 border rounded dark:bg-gray-800 dark:text-white ${className}`}
        placeholder={placeholder}
      />

      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          className={`absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border rounded shadow-lg overflow-auto ${
            compact ? 'max-h-32' : 'max-h-60'
          }`}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelect(suggestion)}
              className={`px-4 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-sm ${
                compact ? 'leading-tight' : ''
              } ${
                index === highlightedIndex ? 'bg-blue-100 dark:bg-blue-800' : ''
              }`}
            >
              {renderSuggestion(suggestion, inputValue, cursorPosition)}
              {index === highlightedIndex && (
                <span className="float-right text-gray-400 text-xs">Tab ↹</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default JSONPathAutocomplete;
