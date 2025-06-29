"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Folder, CheckCircle, Clock, AlertCircle, User } from "lucide-react";

// Mock data
const mockData = {
  workspaces: [
    {
      id: 1,
      name: "Design Team",
      boardCount: 5,
      users: [
        {
          id: 1,
          name: "Alice Johnson",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "AJ",
        },
        {
          id: 2,
          name: "Bob Smith",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "BS",
        },
        {
          id: 3,
          name: "Carol Davis",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "CD",
        },
      ],
      boards: [
        {
          id: 1,
          name: "Website Redesign",
          taskCount: 12,
          tasks: [
            {
              id: 1,
              name: "Create wireframes",
              status: "completed",
              assignee: "Alice Johnson",
            },
            {
              id: 2,
              name: "Design homepage",
              status: "ongoing",
              assignee: "Bob Smith",
            },
            {
              id: 3,
              name: "User testing",
              status: "pending",
              assignee: null,
            },
            {
              id: 4,
              name: "Mobile responsive",
              status: "ongoing",
              assignee: "Carol Davis",
            },
            {
              id: 5,
              name: "Color scheme",
              status: "completed",
              assignee: "Alice Johnson",
            },
          ],
        },
        {
          id: 2,
          name: "Mobile App",
          taskCount: 8,
          tasks: [
            {
              id: 6,
              name: "App architecture",
              status: "completed",
              assignee: "Bob Smith",
            },
            {
              id: 7,
              name: "UI components",
              status: "ongoing",
              assignee: "Carol Davis",
            },
            {
              id: 8,
              name: "API integration",
              status: "pending",
              assignee: null,
            },
          ],
        },
        {
          id: 3,
          name: "Brand Guidelines",
          taskCount: 6,
          tasks: [
            {
              id: 9,
              name: "Logo design",
              status: "completed",
              assignee: "Alice Johnson",
            },
            {
              id: 10,
              name: "Typography",
              status: "ongoing",
              assignee: "Bob Smith",
            },
          ],
        },
      ],
    },
    {
      id: 2,
      name: "Marketing Team",
      boardCount: 3,
      users: [
        {
          id: 4,
          name: "David Wilson",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "DW",
        },
        {
          id: 5,
          name: "Emma Brown",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "EB",
        },
      ],
      boards: [
        {
          id: 4,
          name: "Campaign Q1",
          taskCount: 10,
          tasks: [
            {
              id: 11,
              name: "Social media strategy",
              status: "completed",
              assignee: "David Wilson",
            },
            {
              id: 12,
              name: "Content calendar",
              status: "ongoing",
              assignee: "Emma Brown",
            },
            {
              id: 13,
              name: "Ad creatives",
              status: "pending",
              assignee: null,
            },
          ],
        },
        {
          id: 5,
          name: "Product Launch",
          taskCount: 15,
          tasks: [
            {
              id: 14,
              name: "Press release",
              status: "ongoing",
              assignee: "David Wilson",
            },
            {
              id: 15,
              name: "Influencer outreach",
              status: "pending",
              assignee: null,
            },
          ],
        },
      ],
    },
  ],
};

export default function UserDashboard() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    mockData.workspaces[0]
  );
  const [selectedBoard, setSelectedBoard] = useState(
    mockData.workspaces[0].boards[0]
  );

  const getTaskStats = (tasks) => {
    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;
    const ongoing = tasks.filter((task) => task.status === "ongoing").length;
    const pending = tasks.filter((task) => task.status === "pending").length;
    const unassigned = tasks.filter((task) => !task.assignee).length;

    return { completed, ongoing, pending, unassigned, total: tasks.length };
  };

  const taskStats = getTaskStats(selectedBoard.tasks);

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "ongoing":
        return "bg-blue-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "ongoing":
        return <Clock className="h-4 w-4" />;
      case "pending":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage your workspaces, boards, and tasks
          </p>
        </div>

        {/* Your Workspaces */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Your workspaces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockData.workspaces.map((workspace) => (
              <Card
                key={workspace.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedWorkspace.id === workspace.id
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : ""
                }`}
                onClick={() => {
                  setSelectedWorkspace(workspace);
                  setSelectedBoard(workspace.boards[0]);
                }}
              >
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <h3 className="font-semibold text-lg">{workspace.name}</h3>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Folder className="h-4 w-4" />
                      <span>{workspace.boardCount} Boards</span>
                    </div>
                    <div className="flex justify-center">
                      <div className="flex -space-x-2">
                        {workspace.users.slice(0, 3).map((user) => (
                          <Avatar
                            key={user.id}
                            className="h-8 w-8 border-2 border-white"
                          >
                            <AvatarImage
                              src={user.avatar || "/placeholder.svg"}
                              alt={user.name}
                            />
                            <AvatarFallback className="text-xs">
                              {user.initials}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {workspace.users.length > 3 && (
                          <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                            <span className="text-xs text-gray-600">
                              +{workspace.users.length - 3}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Selected Workspace Boards */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            {selectedWorkspace.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedWorkspace.boards.map((board) => (
              <Card
                key={board.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedBoard.id === board.id
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : ""
                }`}
                onClick={() => setSelectedBoard(board)}
              >
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <h3 className="font-semibold text-lg">{board.name}</h3>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{board.taskCount} Tasks</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Selected Board Details */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            {selectedBoard.name}
          </h2>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tasks
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskStats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {taskStats.completed}
                </div>
                <Progress
                  value={(taskStats.completed / taskStats.total) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  In Progress
                </CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {taskStats.ongoing}
                </div>
                <Progress
                  value={(taskStats.ongoing / taskStats.total) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Unassigned
                </CardTitle>
                <User className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {taskStats.unassigned}
                </div>
                <Progress
                  value={(taskStats.unassigned / taskStats.total) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>

          {/* Tasks Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBoard.tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`${getStatusColor(
                            task.status
                          )} text-white`}
                        >
                          <div className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {task.status.charAt(0).toUpperCase() +
                              task.status.slice(1)}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {task.assignee
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            {task.assignee}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
