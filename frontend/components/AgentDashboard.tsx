import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause, 
  PlayCircle,
  Users,
  Zap,
  TrendingUp,
  Network
} from 'lucide-react';
import backend from '~backend/client';
import type { 
  WorkflowStatus, 
  AgentProgressUpdate, 
  DashboardState, 
  SystemMetrics,
  AgentDependencyGraph 
} from '~backend/agent-monitor/types';

interface AgentDashboardProps {
  className?: string;
}

export default function AgentDashboard({ className }: AgentDashboardProps) {
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [dependencyGraph, setDependencyGraph] = useState<AgentDependencyGraph | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeUpdates, setRealtimeUpdates] = useState<AgentProgressUpdate[]>([]);
  const streamRef = useRef<any>(null);

  // Load initial dashboard state
  useEffect(() => {
    loadDashboardState();
  }, []);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    connectToProgressStream();
    return () => {
      if (streamRef.current) {
        streamRef.current.close();
      }
    };
  }, []);

  // Load dependency graph when workflow is selected
  useEffect(() => {
    if (selectedWorkflow) {
      loadDependencyGraph(selectedWorkflow);
    }
  }, [selectedWorkflow]);

  const loadDashboardState = async () => {
    try {
      const state = await backend["agent-monitor"].getDashboardState();
      setDashboardState(state);
      if (state.workflows.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(state.workflows[0].id);
      }
    } catch (error) {
      console.error('Failed to load dashboard state:', error);
    }
  };

  const loadDependencyGraph = async (workflowId: string) => {
    try {
      const graph = await backend["agent-monitor"].getDependencyGraph({ workflowId });
      setDependencyGraph(graph);
    } catch (error) {
      console.error('Failed to load dependency graph:', error);
    }
  };

  const connectToProgressStream = async () => {
    try {
      const stream = await backend["agent-monitor"].progressStream({});
      streamRef.current = stream;
      setIsConnected(true);

      for await (const update of stream) {
        setRealtimeUpdates(prev => [update, ...prev.slice(0, 49)]);
        
        // Update dashboard state with new progress
        setDashboardState(prevState => {
          if (!prevState) return prevState;
          
          return {
            ...prevState,
            workflows: prevState.workflows.map(workflow => {
              if (workflow.id === update.workflowId) {
                return {
                  ...workflow,
                  agents: workflow.agents.map(agent => {
                    if (agent.id === update.agentId) {
                      return {
                        ...agent,
                        progress: update.progress,
                        status: update.status,
                        estimatedCompletionTime: update.estimatedCompletionTime,
                        error: update.error,
                        outputs: update.outputs
                      };
                    }
                    return agent;
                  })
                };
              }
              return workflow;
            })
          };
        });
      }
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setIsConnected(false);
      
      // Retry connection after 5 seconds
      setTimeout(connectToProgressStream, 5000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  const calculateETA = (estimatedCompletionTime?: Date) => {
    if (!estimatedCompletionTime) return null;
    
    const now = new Date();
    const eta = new Date(estimatedCompletionTime);
    const diff = eta.getTime() - now.getTime();
    
    if (diff <= 0) return 'Overdue';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (!dashboardState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const selectedWorkflowData = dashboardState.workflows.find(w => w.id === selectedWorkflow);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{dashboardState.systemMetrics.activeWorkflows}</div>
                <div className="text-sm text-muted-foreground">Active Workflows</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{dashboardState.systemMetrics.completedWorkflows}</div>
                <div className="text-sm text-muted-foreground">Completed Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{formatDuration(dashboardState.systemMetrics.avgCompletionTime)}</div>
                <div className="text-sm text-muted-foreground">Avg Completion</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{Math.round(dashboardState.systemMetrics.systemLoad)}%</div>
                <div className="text-sm text-muted-foreground">System Load</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedWorkflow || 'overview'} onValueChange={setSelectedWorkflow}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value={selectedWorkflow || 'details'} disabled={!selectedWorkflow}>
            Workflow Details
          </TabsTrigger>
          <TabsTrigger value="graph" disabled={!selectedWorkflow}>
            Dependency Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {dashboardState.workflows.map(workflow => (
                    <Card 
                      key={workflow.id} 
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedWorkflow === workflow.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedWorkflow(workflow.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(workflow.status)}
                            <Badge variant={workflow.status === 'running' ? 'default' : 'secondary'}>
                              {workflow.status}
                            </Badge>
                            <span className="text-sm font-medium">Project {workflow.projectId.slice(0, 8)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ETA: {calculateETA(workflow.estimatedCompletionTime) || 'Calculating...'}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{workflow.progress}%</span>
                          </div>
                          <Progress value={workflow.progress} className="h-2" />
                        </div>
                        
                        <div className="mt-3 text-sm text-muted-foreground">
                          Current Phase: {workflow.currentPhase}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value={selectedWorkflow || 'details'} className="space-y-4">
          {selectedWorkflowData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedWorkflowData.phases.map((phase, index) => (
                      <div key={phase.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(phase.status)}
                            <span className="font-medium">{phase.name}</span>
                            <Badge variant="outline">
                              {phase.progress}%
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Est: {formatDuration(phase.estimatedDuration)}
                          </div>
                        </div>
                        <Progress value={phase.progress} className="h-2" />
                        {index < selectedWorkflowData.phases.length - 1 && (
                          <Separator className="my-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agent Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedWorkflowData.agents.map(agent => (
                      <Card key={agent.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(agent.status)}
                            <span className="font-medium">{agent.name}</span>
                          </div>
                          <Badge variant="outline">{agent.type}</Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{agent.progress}%</span>
                          </div>
                          <Progress value={agent.progress} className="h-1" />
                        </div>
                        
                        {agent.estimatedCompletionTime && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            ETA: {calculateETA(agent.estimatedCompletionTime)}
                          </div>
                        )}
                        
                        {agent.error && (
                          <div className="mt-2 text-sm text-red-500 bg-red-50 p-2 rounded">
                            {agent.error}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="graph" className="space-y-4">
          {dependencyGraph && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Agent Dependency Graph
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DependencyGraphVisualization graph={dependencyGraph} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Real-time Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Real-time Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {realtimeUpdates.map((update, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded bg-accent/50">
                  {getStatusIcon(update.status)}
                  <div className="flex-1">
                    <div className="text-sm">
                      Agent {update.agentId.slice(0, 8)} - {update.progress}% complete
                    </div>
                    {update.message && (
                      <div className="text-xs text-muted-foreground">{update.message}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Dependency Graph Visualization Component
function DependencyGraphVisualization({ graph }: { graph: AgentDependencyGraph }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !graph.nodes.length) return;

    // Simple force-directed layout simulation
    const width = 800;
    const height = 400;
    const nodeRadius = 30;
    
    // Position nodes in a grid for simplicity
    const cols = Math.ceil(Math.sqrt(graph.nodes.length));
    const rows = Math.ceil(graph.nodes.length / cols);
    
    const nodePositions = graph.nodes.map((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        ...node,
        x: (col + 1) * (width / (cols + 1)),
        y: (row + 1) * (height / (rows + 1))
      };
    });

    const svg = svgRef.current;
    svg.innerHTML = '';

    // Draw edges
    graph.edges.forEach(edge => {
      const fromNode = nodePositions.find(n => n.id === edge.from);
      const toNode = nodePositions.find(n => n.id === edge.to);
      
      if (fromNode && toNode) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromNode.x.toString());
        line.setAttribute('y1', fromNode.y.toString());
        line.setAttribute('x2', toNode.x.toString());
        line.setAttribute('y2', toNode.y.toString());
        line.setAttribute('stroke', '#6B7280');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        svg.appendChild(line);
      }
    });

    // Draw nodes
    nodePositions.forEach(node => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x.toString());
      circle.setAttribute('cy', node.y.toString());
      circle.setAttribute('r', nodeRadius.toString());
      circle.setAttribute('fill', getNodeColor(node.status));
      circle.setAttribute('stroke', '#374151');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x.toString());
      text.setAttribute('y', (node.y + 5).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.textContent = node.name.slice(0, 8);
      svg.appendChild(text);
    });

    // Add arrow marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', '#6B7280');
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.insertBefore(defs, svg.firstChild);

  }, [graph]);

  const getNodeColor = (status: string) => {
    switch (status) {
      case 'running':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      case 'paused':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        width="800"
        height="400"
        className="border rounded-lg bg-background"
        viewBox="0 0 800 400"
      />
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Running</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Failed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}