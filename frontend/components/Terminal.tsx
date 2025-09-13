import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Terminal as TerminalIcon, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { terminalConfig } from '../config';

interface TerminalProps {
  projectId: string;
}

function Terminal({ projectId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState('/workspace');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    // Initialize terminal with welcome message
    setOutput([
      'Welcome to Myco Terminal',
      'Type "help" for available commands',
      `Project: ${projectId}`,
      `Working directory: ${currentDirectory}`,
      ''
    ]);
  }, [projectId, currentDirectory]);

  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add command to history
    const newHistory = [...commandHistory, command];
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    // Add command to output
    const newOutput = [...output, `$ ${command}`];
    setOutput(newOutput);
    setIsRunning(true);

    try {
      // Simulate command execution
      const result = await simulateCommand(command.trim());
      setOutput(prev => [...prev, ...result, '']);
    } catch (error) {
      setOutput(prev => [...prev, `Error: ${error}`, '']);
    }

    setIsRunning(false);
    setInput('');
  };

  const simulateCommand = async (command: string): Promise<string[]> => {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return [
          'Available commands:',
          '  ls       - List files and directories',
          '  cd       - Change directory',
          '  pwd      - Print working directory',
          '  cat      - Display file contents',
          '  echo     - Print text',
          '  clear    - Clear terminal',
          '  npm      - Node.js package manager',
          '  node     - Run Node.js',
          '  python   - Run Python',
          '  git      - Git version control',
          '  help     - Show this help message'
        ];

      case 'ls':
        return [
          'package.json',
          'src/',
          'public/',
          'node_modules/',
          'README.md',
          '.gitignore'
        ];

      case 'pwd':
        return [currentDirectory];

      case 'cd':
        const dir = args[0] || '/workspace';
        setCurrentDirectory(dir);
        return [`Changed directory to ${dir}`];

      case 'cat':
        if (!args[0]) {
          return ['Usage: cat <filename>'];
        }
        return [
          `Contents of ${args[0]}:`,
          '// Example file content',
          'console.log("Hello, World!");'
        ];

      case 'echo':
        return [args.join(' ')];

      case 'clear':
        setTimeout(() => setOutput([]), 100);
        return [];

      case 'npm':
        if (args[0] === 'install') {
          return [
            'Installing packages...',
            'npm WARN deprecated package@1.0.0',
            'added 42 packages in 2.1s'
          ];
        }
        if (args[0] === 'start') {
          return [
            'Starting development server...',
            'Server running on http://localhost:3000'
          ];
        }
        return ['npm <command> [options]'];

      case 'node':
        if (args[0]) {
          return [
            `Running: node ${args[0]}`,
            'Hello from Node.js!'
          ];
        }
        return ['Node.js REPL - use with filename'];

      case 'python':
        if (args[0]) {
          return [
            `Running: python ${args[0]}`,
            'Hello from Python!'
          ];
        }
        return ['Python REPL - use with filename'];

      case 'git':
        if (args[0] === 'status') {
          return [
            'On branch main',
            'Your branch is up to date with \'origin/main\'.',
            '',
            'nothing to commit, working tree clean'
          ];
        }
        return ['git version 2.34.1'];

      default:
        return [`Command not found: ${cmd}`];
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        if (newIndex === commandHistory.length - 1 && historyIndex === commandHistory.length - 1) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const clearTerminal = () => {
    setOutput([]);
  };

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [output]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" />
            <CardTitle className="text-sm">Terminal</CardTitle>
            <Badge variant="outline" className="text-xs">
              {currentDirectory}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearTerminal}
              disabled={isRunning}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Terminal Output */}
        <div
          ref={terminalRef}
          className="flex-1 p-4 font-mono text-sm bg-black text-green-400 overflow-y-auto scroll-smooth"
          style={{
            backgroundColor: '#0a0a0a',
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
          }}
        >
          {output.map((line, index) => (
            <div key={index} className="mb-1">
              {line}
            </div>
          ))}
          
          {/* Command Input */}
          <div className="flex items-center">
            <span className="text-blue-400 mr-2">
              {currentDirectory}$
            </span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-green-400"
              placeholder={isRunning ? "Running..." : "Type a command..."}
              disabled={isRunning}
              autoFocus
            />
            {isRunning && (
              <div className="ml-2 text-yellow-400">
                <div className="animate-spin">⟳</div>
              </div>
            )}
          </div>
        </div>

        {/* Terminal Footer */}
        <div className="border-t bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Ready</span>
              <span>{commandHistory.length} commands</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Use ↑↓ for history</span>
              <span>Tab for completion</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Terminal;