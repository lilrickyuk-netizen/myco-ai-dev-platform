import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Trash2, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { terminalConfig } from '../config';

interface TerminalProps {
  projectId: string;
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

const Terminal: React.FC<TerminalProps> = ({ projectId }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to Myco Terminal - Your AI-powered development environment',
      timestamp: new Date(),
    },
    {
      id: '2',
      type: 'system',
      content: 'Type "help" for available commands',
      timestamp: new Date(),
    }
  ]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new lines are added
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = (content: string, type: TerminalLine['type'] = 'output') => {
    const newLine: TerminalLine = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setLines(prev => [...prev, newLine]);
  };

  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add command to history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    // Add command line
    addLine(`$ ${command}`, 'command');

    setIsRunning(true);

    try {
      // Handle built-in commands
      if (command === 'help') {
        addLine('Available commands:');
        addLine('  help                 - Show this help message');
        addLine('  clear                - Clear terminal');
        addLine('  ls                   - List files');
        addLine('  pwd                  - Print working directory');
        addLine('  node --version       - Show Node.js version');
        addLine('  npm --version        - Show npm version');
        addLine('  npm install          - Install dependencies');
        addLine('  npm start            - Start development server');
        addLine('  npm run build        - Build project');
        addLine('  npm test             - Run tests');
        addLine('  git status           - Show git status');
        addLine('');
      } else if (command === 'clear') {
        setLines([]);
      } else if (command === 'pwd') {
        addLine('/workspace/project');
      } else if (command === 'ls') {
        // This would integrate with the file system
        addLine('src/');
        addLine('public/');
        addLine('package.json');
        addLine('README.md');
        addLine('tsconfig.json');
      } else if (command === 'node --version') {
        addLine('v20.10.0');
      } else if (command === 'npm --version') {
        addLine('10.2.3');
      } else if (command.startsWith('npm install')) {
        addLine('Installing dependencies...');
        // Simulate installation
        await new Promise(resolve => setTimeout(resolve, 2000));
        addLine('✓ Dependencies installed successfully');
      } else if (command === 'npm start') {
        addLine('Starting development server...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        addLine('✓ Development server started on http://localhost:3000');
      } else if (command === 'npm run build') {
        addLine('Building project...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        addLine('✓ Build completed successfully');
      } else if (command === 'npm test') {
        addLine('Running tests...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        addLine('✓ All tests passed');
      } else if (command === 'git status') {
        addLine('On branch main');
        addLine('Your branch is up to date with \'origin/main\'.');
        addLine('');
        addLine('Changes not staged for commit:');
        addLine('  modified:   src/App.tsx');
        addLine('  modified:   src/components/Header.tsx');
        addLine('');
      } else {
        // For unknown commands, show error
        addLine(`Command not found: ${command}`, 'error');
        addLine('Type "help" for available commands');
      }
    } catch (error) {
      addLine(`Error executing command: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
      setCurrentCommand('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Basic tab completion for commands
      const commands = ['help', 'clear', 'ls', 'pwd', 'npm install', 'npm start', 'npm run build', 'npm test', 'git status'];
      const matches = commands.filter(cmd => cmd.startsWith(currentCommand));
      if (matches.length === 1) {
        setCurrentCommand(matches[0]);
      }
    }
  };

  const clearTerminal = () => {
    setLines([]);
  };

  const downloadLogs = () => {
    const logContent = lines
      .map(line => `[${line.timestamp.toISOString()}] ${line.type.toUpperCase()}: ${line.content}`)
      .join('\n');
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'command': return 'text-blue-400';
      case 'error': return 'text-red-400';
      case 'system': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* Terminal Header */}
      <div className="border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-sm font-medium">Terminal</span>
            {isRunning && (
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400"></div>
                <span>Running...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearTerminal}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadLogs}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Logs
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearTerminal}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Terminal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-1 font-mono text-sm">
            {lines.map((line) => (
              <div key={line.id} className={`${getLineColor(line.type)} whitespace-pre-wrap`}>
                {line.content}
              </div>
            ))}
            
            {/* Command Input Line */}
            <div className="flex items-center space-x-2 text-blue-400">
              <span>$</span>
              <Input
                ref={inputRef}
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border-0 bg-transparent p-0 text-blue-400 focus:ring-0 font-mono"
                placeholder={isRunning ? "Running..." : "Type a command..."}
                disabled={isRunning}
                autoFocus
              />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Terminal Footer */}
      <div className="border-t border-gray-700 bg-gray-800 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Ready</span>
            <span>{lines.length} lines</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Use ↑↓ for history</span>
            <span>Tab for completion</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terminal;import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Button } from "@/components/ui/button";
import { Trash2, Play, Square } from "lucide-react";
import { useBackend } from "../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import "xterm/css/xterm.css";

interface TerminalProps {
  projectId: string;
}

export function Terminal({ projectId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [mounted, setMounted] = useState(false);
  const [running, setRunning] = useState(false);
  const backend = useBackend();
  const { toast } = useToast();

  useEffect(() => {
    if (!terminalRef.current || mounted) return;

    // Create terminal instance
    const xterm = new XTerm({
      theme: {
        background: "hsl(var(--card))",
        foreground: "hsl(var(--foreground))",
        cursor: "hsl(var(--primary))",
        selection: "hsl(var(--muted))",
        black: "hsl(var(--muted-foreground))",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "hsl(var(--foreground))",
        brightBlack: "hsl(var(--muted-foreground))",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "hsl(var(--foreground))"
      },
      fontSize: 14,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 1000,
      tabStopWidth: 4
    });

    // Create fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());

    // Open terminal
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Welcome message
    xterm.writeln("\x1b[1;32m┌─────────────────────────────────────────┐\x1b[0m");
    xterm.writeln("\x1b[1;32m│           Myco Terminal v1.0            │\x1b[0m");
    xterm.writeln("\x1b[1;32m└─────────────────────────────────────────┘\x1b[0m");
    xterm.writeln("");
    xterm.writeln("Type commands or run your code using the Run button.");
    xterm.writeln("");
    xterm.write("$ ");

    // Handle input
    let currentLine = "";
    
    xterm.onData((data) => {
      const char = data.charCodeAt(0);
      
      if (char === 13) { // Enter
        xterm.writeln("");
        if (currentLine.trim()) {
          executeCommand(currentLine.trim());
        }
        currentLine = "";
        xterm.write("$ ");
      } else if (char === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm.write("\b \b");
        }
      } else if (char >= 32) { // Printable characters
        currentLine += data;
        xterm.write(data);
      }
    });

    const executeCommand = async (command: string) => {
      try {
        setRunning(true);
        const response = await backend.execution.executeCommand({
          projectId,
          command
        });
        
        if (response.output) {
          xterm.writeln(response.output);
        }
        if (response.error) {
          xterm.writeln(`\x1b[31m${response.error}\x1b[0m`);
        }
      } catch (err) {
        console.error("Command execution failed:", err);
        xterm.writeln(`\x1b[31mError: Failed to execute command\x1b[0m`);
      } finally {
        setRunning(false);
      }
    };

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener("resize", handleResize);
    setMounted(true);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, [projectId, backend, mounted]);

  const clearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.write("$ ");
    }
  };

  const runProject = async () => {
    if (!xtermRef.current) return;

    try {
      setRunning(true);
      xtermRef.current.writeln("Running project...");
      
      const response = await backend.execution.run({ projectId });
      
      if (response.output) {
        xtermRef.current.writeln(response.output);
      }
      if (response.error) {
        xtermRef.current.writeln(`\x1b[31m${response.error}\x1b[0m`);
      }
    } catch (err) {
      console.error("Failed to run project:", err);
      xtermRef.current.writeln(`\x1b[31mError: Failed to run project\x1b[0m`);
      toast({
        title: "Error",
        description: "Failed to run project.",
        variant: "destructive"
      });
    } finally {
      setRunning(false);
    }
  };

  const stopExecution = async () => {
    try {
      await backend.execution.stop({ projectId });
      if (xtermRef.current) {
        xtermRef.current.writeln("\x1b[33mExecution stopped\x1b[0m");
      }
      setRunning(false);
    } catch (err) {
      console.error("Failed to stop execution:", err);
      toast({
        title: "Error",
        description: "Failed to stop execution.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold">Terminal</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={runProject}
            disabled={running}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Run
          </Button>
          
          {running && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopExecution}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 p-2">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  );
}
