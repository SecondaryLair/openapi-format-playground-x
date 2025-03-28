import React, {useEffect, useRef, useState} from 'react';
import Editor, {OnMount} from '@monaco-editor/react';
import * as monacoEditor from 'monaco-editor';
import type { editor } from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
  extraSuggestions?: string[];
}

const MonacoEditorComponent: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language,
  height = '85vh',
  extraSuggestions = []
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [theme, setTheme] = useState<'vs-light' | 'vs-dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs-light'
  );

  const handleEditorDidMount: OnMount = async (editor, monacoInstance: typeof monacoEditor) => {
    editorRef.current = editor;
    monacoInstance.editor.setTheme(theme);

    // Register custom completion provider if extraSuggestions are provided
    if (extraSuggestions && extraSuggestions.length > 0) {
      // Configure JSON/YAML language defaults first
      if (language === 'json') {
        monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: true,
          schemas: []
        });
      }

      monacoInstance.languages.registerCompletionItemProvider(language || 'yaml', {
        provideCompletionItems: async (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };

          try {
            // Combine with our extra suggestions
            const suggestions = extraSuggestions.map(suggestion => ({
              label: suggestion,
              kind: monacoEditor.languages.CompletionItemKind.Property,
              insertText: suggestion,
              range: range
            }));

            // Remove duplicates by label while preserving order
            const uniqueSuggestions = suggestions.reduce(
              (acc: monacoEditor.languages.CompletionItem[], current) => {
                if (!acc.some((item: monacoEditor.languages.CompletionItem) => item.label === current.label)) {
                  acc.push(current);
                }
                return acc;
              },
              []
            );

            return { suggestions: uniqueSuggestions };
          } catch (error) {
            console.error('Error getting completion items:', error);
            return { suggestions: [] };
          }
        }
      });
    }
  };

  useEffect(() => {
    // Listen for changes in system theme
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'vs-dark' : 'vs-light');
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Cleanup listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      monacoEditor.editor.setTheme(theme);
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== value) {
        model.setValue(value);
      }
    }
  }, [value, theme]);

  const updateEditorValue = (newValue: string) => {
    if (editorRef.current) {
      editorRef.current.setValue(newValue);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value != null && editorRef.current) {
      editorRef.current.setValue(value);
    }
  }

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    fontFamily: '"Cascadia Code", "Jetbrains Mono", "Fira Code", "Menlo", "Consolas", monospace',
    fontLigatures: true,
    fontSize: 12,
    lineHeight: 20,
    minimap: { enabled: false },
    tabSize: 2,
    automaticLayout: true,
    scrollBeyondLastLine: false,
  };

  return (
    <Editor
      height={height}
      defaultLanguage="yaml"
      language={language}
      defaultValue={value}
      value={value}
      onChange={onChange ? (value) => onChange(value || '') : undefined}
      onMount={handleEditorDidMount}
      options={editorOptions}
    />
  );
};

export default MonacoEditorComponent;
