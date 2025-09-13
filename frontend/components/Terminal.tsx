import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
  height: number;
  onHeightChange: (height: number) => void;
  className?: string;
}

export default function Terminal({ isOpen, onClose, height, onHeightChange, className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState<string[]>(['Welcome to Hybrid Dev Terminal v1.0', '$ ']);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleCommand = (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Add command to history
    setCommandHistory(prev => [...prev, trimmedCommand]);
    setHistoryIndex(-1);

    // Add command to output
    setOutput(prev => [...prev, `$ ${trimmedCommand}`]);

    // Process command
    processCommand(trimmedCommand);
    setCurrentInput('');
  };

  const processCommand = (command: string) => {
    const args = command.split(' ');
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'help':
        setOutput(prev => [...prev, 
          'Available commands:',
          '  help     - Show this help message',
          '  clear    - Clear terminal',
          '  ls       - List files',
          '  pwd      - Print working directory',
          '  echo     - Echo text',
          '  npm      - Run npm commands',
          '  node     - Run node commands',
          '  git      - Git commands',
          '',
          '$ '
        ]);
        break;
      case 'clear':
        setOutput(['$ ']);
        break;
      case 'ls':
        setOutput(prev => [...prev, 
          'src/',
          'public/',
          'package.json',
          'README.md',
          '$ '
        ]);
        break;
      case 'pwd':
        setOutput(prev => [...prev, '/workspace/project', '$ ']);
        break;
      case 'echo':
        const echoText = args.slice(1).join(' ');
        setOutput(prev => [...prev, echoText, '$ ']);
        break;
      case 'npm':
        if (args[1] === 'install') {
          setOutput(prev => [...prev, 
            'Installing dependencies...',
            'Dependencies installed successfully!',
            '$ '
          ]);
        } else if (args[1] === 'run') {
          setOutput(prev => [...prev, 
            `Running script: ${args[2]}`,
            'Script executed successfully!',
            '$ '
          ]);
        } else {
          setOutput(prev => [...prev, `npm: command '${args[1]}' not found`, '$ ']);
        }
        break;
      case 'git':
        if (args[1] === 'status') {
          setOutput(prev => [...prev, 
            'On branch main',
            'Your branch is up to date.',
            '',
            'Changes not staged for commit:',
            '  modified:   src/App.tsx',
            '  modified:   package.json',
            '$ '
          ]);
        } else {
          setOutput(prev => [...prev, `git: command '${args[1]}' not implemented`, '$ ']);
        }
        break;
      default:
        setOutput(prev => [...prev, `Command not found: ${cmd}`, '$ ']);
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(currentInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex === commandHistory.length - 1 ? -1 : historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentInput(newIndex === -1 ? '' : commandHistory[newIndex]);
      }
    }
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  if (!isOpen) return null;

  return (
    <div 
      className={`bg-gray-900 border-t border-gray-700 flex flex-col ${className}`}
      style={{ height: isMaximized ? '100vh' : height }}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-gray-200">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsMaximized(!isMaximized)}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
          >
            {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="flex-1 p-4 font-mono text-sm text-green-400 overflow-y-auto bg-black"
      >
        {output.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap">
            {line}
            {index === output.length - 1 && line.endsWith('$ ') && (
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-green-400 font-mono"
                style={{ width: `${Math.max(currentInput.length + 1, 1)}ch` }}
                autoFocus
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}